import 'dotenv/config' // .env setup
import { cleanEnv, str, host, port, url } from 'envalid'
import process from 'node:process'

const enableEnvalid = !process.env.DISABLE_ENVALID

const envalidConfig = {
  NODE_ENV: str({ choices: ['test', 'development', 'production'], default: 'development' }),
  APP_ENV: str({ choices: ['dev', 'stage', 'prod'], default: 'dev' }),
  APP_ENV_SLUG: str({ default: 'dev' }),
  LOG_LEVEL: str({
    choices: ['fatal', /* 50 */ 'error', /* 40 */ 'warn', /* 30 */ 'info', /* 20 */ 'debug', /* 10 */ 'trace'],
    default: 'info'
  }),

  PORT: port({ default: 8000 }),
  METRICS_PORT: port({ default: 9090 }),

  SCRAPER_URL: url(),
  ETH_NODE_URL: url(),
  ELASTIC_URL: url(),

  DB_NAME: str(),
  DB_HOST: host(),
  POSTGRES_CONN: str({ default: '' }),
  DB_USER: str(),
  DB_PASSWORD: str(),

  KAFKA_HOST: host(),
  KAFKA_PORT: port(),
  KAFKA_USER: str(),
  KAFKA_PASSWORD: str(),
  KAFKA_TOPIC: str(),
  KAFKA_HIGH_PRIORITY_TOPIC: str(),
  KAFKA_ENS_TOPIC: str(),

  TWITTER_API_KEY: str()
}

const env = enableEnvalid
  ? cleanEnv(process.env, envalidConfig)
  : cleanEnv(process.env, envalidConfig, {
    reporter: () => {}
  })

const { NODE_ENV, APP_ENV } = env

export const config = {
  appEnv: APP_ENV,
  env: {
    isTest: NODE_ENV === 'test',
    isDev: NODE_ENV === 'development',
    isProd: NODE_ENV === 'production',
    logLevel: env.LOG_LEVEL
  },
  app: {
    port: env.PORT
  },
  metrics: {
    port: env.METRICS_PORT
  },
  scraper: {
    url: env.SCRAPER_URL
  },
  eth: {
    nodeUrl: env.ETH_NODE_URL
  },
  elastic: {
    url: env.ELASTIC_URL
  },
  db: {
    connectionString: env.POSTGRES_CONN,
    name: env.DB_NAME,
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD
  },
  kafka: {
    host: env.KAFKA_HOST,
    port: env.KAFKA_PORT,
    username: env.KAFKA_USER,
    password: env.KAFKA_PASSWORD,
    topicId: env.KAFKA_TOPIC,
    highPriorityTopicId: env.KAFKA_HIGH_PRIORITY_TOPIC,
    ensTopicId: env.KAFKA_ENS_TOPIC
  },
  twitter: {
    apiKey: env.TWITTER_API_KEY
  }
}
