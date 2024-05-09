import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Certificate, ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { AllowedMethods, BehaviorOptions, CachePolicy, Distribution, DistributionProps, EdgeLambda, OriginBase, OriginRequestPolicy, PriceClass, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { IContext, OriginAlb, OriginFunctionUrl, OriginType } from '../context/IContext';
import { createEdgeFunction } from './EdgeFunction';
import { getAlbOrigin } from './OriginAlb';
import { getFunctionUrlOrigin } from './OriginFunctionUrl';
import path = require('path');

/**
 * This construct creates the cloudfront distribution, along with the edge functions and origins that
 * it needs. Thus, all stack resources are accounted for here. 
 */
export class CloudfrontDistribution extends Construct {
  // The path of the origin request edge lambda code asset relative to the root of the project
  public static EDGE_REQUEST_ORIGIN_CODE_FILE:string = 'cdk.out/asset.origin.request/index.js';
  
  private stack:Construct;
  private context:IContext;
  private edgeFunctionForOriginRequest:NodejsFunction|undefined;
  private edgeLambdas = [] as EdgeLambda[];
  private origin:OriginBase;
  private testOrigin:OriginBase;
  private cloudFrontDistribution:Distribution;

  constructor(stack: Construct, stackName: string, props?: any) {
    
    super(stack, stackName);

    this.stack = stack;

    const context = stack.node.getContext('stack-parms');
    this.context = context;
    
    const { validateContext, createDistribution, edgeFunctionForOriginRequest, edgeLambdas } = this;
    const { REGION, ORIGIN } = context;

    // 1) Validate context parameters
    validateContext();

    // 2) Create lambda@Edge function
    const scope = REGION == 'us-east-1' ? stack : this;
    createEdgeFunction(scope, context, (edgeLambda:any, ) => {
      edgeLambdas.push(edgeLambda);
      if(REGION == 'us-east-1') {
        this.edgeFunctionForOriginRequest = edgeLambda;
      }
    });

    // 3) Create the primary origin if indicated.
    if(ORIGIN) {
      switch(ORIGIN.originType) {
        case OriginType.ALB:
          this.origin = getAlbOrigin(ORIGIN as OriginAlb);
          break;
        case OriginType.FUNCTION_URL:
          this.origin = getFunctionUrlOrigin({
            stack, context, edgeFunctionForOriginRequest, edgeLambdas, origin:(ORIGIN as OriginFunctionUrl)
          }) as HttpOrigin;
          break;
      };
    }

    // 4) Create the test origin
    const testOrigin = { originType:OriginType.FUNCTION_URL } as OriginFunctionUrl;
    this.testOrigin = getFunctionUrlOrigin({
      // Omission of the OriginFunctionUrl.url parameter signifies this is the test origin.
      stack, context, edgeFunctionForOriginRequest, edgeLambdas, origin: testOrigin
    });

    // 5) Create the distribution
    createDistribution();
  
    new CfnOutput(stack, 'CloudFrontDistributionURL', {
      value: `https://${this.cloudFrontDistribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });
  }

  private isBlankString = (s:string|null|undefined) => s == undefined || s == null || `${s.trim()}` == '';

  /**
   * Make sure there are no invalid combinations or omissions of context.json fields.
   */
  private validateContext = () => {
    const { context: { ORIGIN }, isBlankString } = this;
    if( ! ORIGIN) {
      return;
    }
    const { originType, arn, certificateARN, hostedDomain, hostedZone } = ORIGIN;

    // An alb must be configured with dnsName and arn specified
    if(originType == OriginType.ALB) {
      const { dnsName } = (ORIGIN as OriginAlb);
      const msg = 'An alb origin was configured in context.json';
      if(isBlankString(dnsName)) throw new Error(`${msg} without its dnsName value`);
      if(isBlankString(arn)) throw new Error(`${msg} without its arn value`)
    }

    // Validate dns/ssl items.
    const errorMsg = 'hostedZone, hostedDomain, and certifidateARN are mutually inclusive'
    const throwError = () => { throw new Error(errorMsg); }
    if( ! isBlankString(certificateARN) && (isBlankString(hostedDomain) || isBlankString(hostedZone))) throwError();
    if( ! isBlankString(hostedDomain) && (isBlankString(certificateARN) || isBlankString(hostedZone))) throwError();
    if( ! isBlankString(hostedZone) && (isBlankString(hostedDomain) || isBlankString(certificateARN))) throwError();

    // hostedDomain must be a subdomain of, or equal, hostedZone
    if( ( ! isBlankString(hostedDomain)) && hostedDomain != hostedZone) {
      if( ! hostedDomain!.endsWith(`.${hostedZone}`)) {
        throw new Error(`${hostedDomain} is not a subdomain of ${hostedZone}`);
      }
    }
  }

  /**
   * Create the cloudfront distribution.
   * 
   * NOTE 1: VIEWER_REQUEST event type would have been preferable so that the edge lambda is hit despite what's in
   * the cache. However, that means a 1 MB code limit, which seems to be exceeded, making ORIGIN_REQUEST the
   * only choice with a 50 MB code limit. In order for the lambda get hit for EVERY request, caching is disabled.
   * 
   * NOTE 2: ALL_VIEWER_EXCEPT_HOST_HEADER will ensure the HTTP_HOST header contains the origins host domain, 
   * not the domain of the cloudfront distribution. This keeps lambda function url origins working correctly,
   */
  private createDistribution = () => {
    const { stack, context, origin, testOrigin, edgeLambdas, isBlankString } = this;
    const { TAGS, STACK_ID, ORIGIN } = context;
    const { hostedDomain, certificateARN } = ORIGIN || {};
    const distributionName = `${STACK_ID}-cloudfront-distribution-${TAGS.Landscape}`;
    const domainNames = [] as string[];
    
    if( ! isBlankString(hostedDomain)) domainNames.push(hostedDomain!);
    const customDomain = ():boolean => domainNames.length > 0;

    /**
     * Construct a behavior for the provided origin
     * @param origin 
     * @param customDomain 
     * @returns 
     */
    const getBehavior = (origin:OriginBase, customDomain:boolean):BehaviorOptions => {
      const { ALLOW_ALL, REDIRECT_TO_HTTPS } = ViewerProtocolPolicy;
      const { ALL_VIEWER, ALL_VIEWER_EXCEPT_HOST_HEADER } = OriginRequestPolicy
    
      return {
        origin,
        edgeLambdas,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: customDomain ? REDIRECT_TO_HTTPS : ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED, // See NOTE 1
        originRequestPolicy: customDomain ? ALL_VIEWER : ALL_VIEWER_EXCEPT_HOST_HEADER, // See NOTE 2
      } as BehaviorOptions
    }

    /**
     * @returns A behavior for the test origin if no primary origin is configured in context.json, 
     * else a behavior based on the configured origin.
     */
    const getDefaultBehavior = ():BehaviorOptions => {
      if(origin) {
        return getBehavior(origin, customDomain());
      }
      return getBehavior(testOrigin, false);
    }

    // Configure distribution properties
    let distributionProps = {
      priceClass: PriceClass.PRICE_CLASS_100,
      logBucket: new Bucket(stack, `${distributionName}-logs-bucket`, {
        removalPolicy: RemovalPolicy.DESTROY,    
        autoDeleteObjects: true,
        objectOwnership: ObjectOwnership.OBJECT_WRITER
      }),
      comment: `shib-lambda-${TAGS.Landscape}-distribution`,  
      domainNames, 
      defaultBehavior: getDefaultBehavior(),
    } as DistributionProps

    if(origin) {
      // Associate the test origin with an additional behavior
      distributionProps = Object.assign({
        additionalBehaviors: {
          '/testing123/': getBehavior(testOrigin, false)
        }
      }, distributionProps);
    }
    
    // Extend distribution properties to include certificate and domain if indicated.
    if( customDomain()) {
      const certificate:ICertificate = Certificate.fromCertificateArn(this, `${distributionName}-acm-cert`, certificateARN!);
      distributionProps = Object.assign({
        certificate, 
        domainNames
      }, distributionProps);
    }

    // Create the cloudFront distribution
    this.cloudFrontDistribution = new Distribution(stack, distributionName, distributionProps);
  }

}

