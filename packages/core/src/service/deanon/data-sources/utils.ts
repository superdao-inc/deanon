const regex1 = /(?:twitter\.com\/@?|@)(.+)$/i
const regex2 = /[A-Za-z0-9_]{1,15}/

export function normalizeTwitter (twitter: string): string {
  const match = regex1.exec(twitter)
  if (match != null) {
    twitter = match[1]
  }

  twitter = twitter.replace('.', '_')

  const match1 = regex2.exec(twitter)

  if (match1 != null) {
    twitter = match1[0]
  }

  return twitter
}
