export interface TwitterResponseEmpty {
  wallet_address: string
  source: string
  twitter_username: string
}

export interface TwitterResponseEnriched {
  wallet_address: string
  source: string
  twitter_id: string
  twitter_url: string
  twitter_name: string
  twitter_location: string
  twitter_avatar_url: string
  twitter_username: string
  twitter_followers_count: string
  twitter_bio: string
}
