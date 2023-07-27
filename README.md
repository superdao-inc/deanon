## Deanonimization-tool

This tool is used for the following purposes:
- Get the Twitter username by ethereum wallet address
- Get the ENS name by ethereum wallet address

## Installation

```bash
pnpm install
```

## Usage

First of all, you need to create a `.env` file in the `packages/core` directory of the project and fill it with the data from .env.example.

After that add your own values to the `.env` file:
```bash
SCRAPER_URL=your_scraper_url
TWITTER_API_KEY=your_twitter_api_key
ETHEREUM_NODE_URL=your_ethereum_node_url
```
About the `SCRAPER_URL` – we used [this utility](https://github.com/VeNoMouS/cloudscraper) with our own FastAPI wrapper.
It was used as a workaround for the Cloudflare protection to get Twitter username from OpenSea.

For local development, you can start the docker container with the database, kafka and kafkaui using the following command:
```bash
docker-compose up -d
```

To start the application, use the following command:
```bash
pnpm run dev:core
```

To test the application, use one of the following commands:
1) To check that your Twitter API key is valid:
```bash
# it should return Twitter username for user id 1447889684508540936
curl -X GET http://localhost:8000/twitter 
```
2) To get the Twitter username by ethereum wallet addresses(csv file):
```bash
curl -X POST http://localhost:8000/produce
```
