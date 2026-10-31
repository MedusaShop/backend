import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const fileProviders: any[] = []

if (process.env.S3_BUCKET) {
  fileProviders.push({
    resolve: "@medusajs/file-s3",
    id: "s3",
    options: {
      file_url: process.env.CDN_URL || process.env.S3_FILE_URL,
      access_key_id: process.env.S3_ACCESS_KEY_ID,
      secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
      region: process.env.S3_REGION || "us-east-1",
      bucket: process.env.S3_BUCKET,
      endpoint: process.env.S3_ENDPOINT,
      acl: false,
      additional_client_config: {
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      },
    },
  })
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    ...(fileProviders.length > 0
      ? [
          {
            resolve: "@medusajs/medusa/file",
            options: {
              providers: fileProviders,
            },
          },
        ]
      : []),
  ],
})
