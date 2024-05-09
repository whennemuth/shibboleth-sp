export interface IContext {
    STACK_ID:                           string;
    ACCOUNT:                            string;
    REGION:                             string;
    LANDSCAPE:                          string;
    EDGE_REQUEST_ORIGIN_FUNCTION_NAME:  string;
    EDGE_RESPONSE_VIEWER_FUNCTION_NAME: string;
    APP_FUNCTION_NAME:                  string;
    ORIGIN?:                            Origin;
    APP_LOGIN_HEADER:                   string;
    APP_LOGOUT_HEADER:                  string;
    SHIBBOLETH:                         Shibboleth;
    TAGS:                               Tags;
}

export enum OriginType {
    ALB = 'alb', FUNCTION_URL = 'function-url'
};
export type Origin = {
    originType:          OriginType;
    arn?:                string;
    httpPort?:           number;
    httpsPort:           number;
    appAuthorization:    boolean;
    hostedZone?:         string;
    hostedDomain?:       string; // Includes hostedZone AND subdomain
    certificateARN?:     string;
    cloudfrontChallenge: CloudfrontChallenge;
};

export interface OriginFunctionUrl extends Origin {
    originType: OriginType.FUNCTION_URL;
    url?:       String
};
export interface OriginAlb extends Origin {
    originType: OriginType.ALB;
    dnsName:    string;
};

export interface CloudfrontChallenge {
    headerName: string,
    headerValue: string
}

export interface Shibboleth {
    entityId:   string;
    idpCert:    string;
    entryPoint: string;
    logoutUrl:  string;
    secret:     Secret;
}

export interface Secret {
    _secretArn:              string;
    _refreshInterval:        string;
    samlPrivateKeySecretFld: string;
    samlCertSecretFld:       string;
    jwtPrivateKeySecretFld:  string;
    jwtPublicKeySecretFld:   string;
}

export interface Tags {
    Service:   string;
    Function:  string;
    Landscape: string;
}
