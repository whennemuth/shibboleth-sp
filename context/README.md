## Configuration Context

CDK stack deployment imports context.json for configuration details.
The content of this file is cast to a type found in IContext.ts
In order to create IContext.ts or modify it to reflect changes to context.json run the following:

```
cd context/
quicktype context.json -o IContext.ts
```

