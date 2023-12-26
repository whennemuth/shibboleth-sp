# Running locally

### Overview: Run two containers:

1. **Container A**: A lambda@edge simulator.
   The nodejs package that backs the lambda@edge origin request function will run in a container and be exposed to ones browser over port 5000.
2. **Container B**: The targeted origin or "app".
   This will be something like wordpress or anything else that listens for https requests.

With these two containers running, the cloud-based scenario is simulated to some degree in that all requests bound for container B must go through container A first to be inspected for tokens and proof of authenticated status with the shibboleth IDP.

Container A is essentially a nodejs/express app acting as a reverse proxy with some "adapter" functionality applied.
The "adapter" functionality allows container A to simulate cloudfront@edge, by transforming http requests from express into objects that conform to the [lambda@edge event structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html#lambda-event-structure-request) before passing them in to the main lambda@edge nodejs artifact. Similarly, all response objects returned are converted back into regular http responses on their way back to the client.

### Steps to run:

1. **Install:**
   Install dependencies for the main module and all nested modules:

   ```
   npm run install-all
   ```

2. **Run:**

   - **METHOD A:**
     This is one method that facilitates step debugging with a vscode launch configuration. 
     It can be found In `.vscode/launch.json`:

     ```
     {
       "type": "node",
       "request": "launch",
       "name": "sp-express-app",
       "skipFiles": [
         "<node_internals>/**"
       ],
       "args": [
         "${workspaceFolder}/docker/index.js",
       ], 
       "env": {
         "AWS_PROFILE": "bu",
         "TZ": "utc",
         "LOCAL_DOMAIN_AND_PORT": "localhost:5000"
       }   
     }
     ```

     1. **Set credentials**:
        One of the tasks performed by the lambda@edge origin request function is to make a call to secrets manager to acquire secrets for shibboleth and JWT tokens. The `AWS_PROFILE` environment variable can be changed to reflect the appropriate credentials in your `~/.aws/credentials` file. Or you can swap  `AWS_PROFILE` out entirely for `AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY`, & `AWS_SESSION_TOKEN` values.

     2. **Build:**
        Bundle the main lambda@edge nodejs package:

        ```
        npm run bundle
        ```

     3. **Launch**:
        Run the launch configuration and navigate to https://localhost:5000/some/path?qs=some_value

        

   - **METHOD B:**

     Run containers
     *NOTE: These steps focus on just plain docker and are temporary until docker-compose is introduced - WORK IN PROGRESS.*

     1. From the root of the project, navigate to the docker directory

     2. Put credentials in a .env file:

        ```
        AWS_ACCESS_KEY_ID=your_key_id
        AWS_SECRET_ACCESS_KEY=your_key
        AWS_SESSION_TOKEN=your_session_token
        TZ=utc
        ```

        *NOTE: It is important that TZ is present and set to utc (Do not pick another time zone).*

     3. Use npm to run container A

        ```
        npm run up
        ```

        

