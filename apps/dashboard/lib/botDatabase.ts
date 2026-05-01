// ═══════════════════════════════════════════════════════════════════════════
// ScraperKast — Comprehensive Bot Database (200+ bots)
// ═══════════════════════════════════════════════════════════════════════════

export type BotType = 'ai' | 'scraper' | 'search' | 'social' | 'monitoring';

export interface BotEntry {
  id:            string;
  name:          string;      // Display name, e.g. "GPTBot"
  company:       string;      // e.g. "OpenAI"
  type:          BotType;
  userAgent:     string;      // Substring to match in User-Agent header
  description?:  string;
  website?:      string;
  defaultPrice?: number;      // USDC cents (0.001 = $0.001). Omit = use global default
}

// Default price per request in USD when not overridden
export const DEFAULT_PRICE_USD = 0.001;

export const BOT_DATABASE: BotEntry[] = [

  // ─── OpenAI ───────────────────────────────────────────────────────────────
  { id: 'gptbot',           name: 'GPTBot',           company: 'OpenAI',                  type: 'ai',         userAgent: 'GPTBot',                description: 'OpenAI web crawler for training data',       website: 'https://openai.com/gptbot'    },
  { id: 'chatgpt-user',     name: 'ChatGPT-User',     company: 'OpenAI',                  type: 'ai',         userAgent: 'ChatGPT-User',          description: 'ChatGPT browsing plugin requests'                                            },
  { id: 'oai-searchbot',    name: 'OAI-SearchBot',    company: 'OpenAI',                  type: 'ai',         userAgent: 'OAI-SearchBot',         description: 'OpenAI search product crawler'                                               },
  { id: 'openai-platform',  name: 'OpenAI Platform',  company: 'OpenAI',                  type: 'ai',         userAgent: 'openai-platform'                                                                                                   },

  // ─── Anthropic ────────────────────────────────────────────────────────────
  { id: 'claudebot',        name: 'ClaudeBot',        company: 'Anthropic',               type: 'ai',         userAgent: 'ClaudeBot',             description: 'Anthropic Claude web crawler'                                                },
  { id: 'claude-web',       name: 'Claude-Web',       company: 'Anthropic',               type: 'ai',         userAgent: 'Claude-Web'                                                                                                        },
  { id: 'anthropic-ai',     name: 'anthropic-ai',     company: 'Anthropic',               type: 'ai',         userAgent: 'anthropic-ai'                                                                                                      },

  // ─── Google ───────────────────────────────────────────────────────────────
  { id: 'google-extended',  name: 'Google-Extended',  company: 'Google',                  type: 'ai',         userAgent: 'Google-Extended',       description: 'Google AI training crawler'                                                  },
  { id: 'googlebot',        name: 'Googlebot',        company: 'Google',                  type: 'search',     userAgent: 'Googlebot',             description: 'Google Search crawler'                                                       },
  { id: 'googlebot-image',  name: 'Googlebot-Image',  company: 'Google',                  type: 'search',     userAgent: 'Googlebot-Image',       description: 'Google Image Search crawler'                                                 },
  { id: 'googlebot-news',   name: 'Googlebot-News',   company: 'Google',                  type: 'search',     userAgent: 'Googlebot-News'                                                                                                    },
  { id: 'googlebot-video',  name: 'Googlebot-Video',  company: 'Google',                  type: 'search',     userAgent: 'Googlebot-Video'                                                                                                   },
  { id: 'google-inspect',   name: 'Google Inspect',   company: 'Google',                  type: 'search',     userAgent: 'Google-InspectionTool'                                                                                             },
  { id: 'adsbot-google',    name: 'AdsBot-Google',    company: 'Google',                  type: 'search',     userAgent: 'AdsBot-Google'                                                                                                     },
  { id: 'mediapartners',    name: 'Mediapartners',    company: 'Google',                  type: 'search',     userAgent: 'Mediapartners-Google'                                                                                              },
  { id: 'storebot-google',  name: 'StoreBot-Google',  company: 'Google',                  type: 'search',     userAgent: 'storebot-google'                                                                                                   },

  // ─── Microsoft / Bing ─────────────────────────────────────────────────────
  { id: 'bingbot',          name: 'Bingbot',          company: 'Microsoft',               type: 'search',     userAgent: 'bingbot',               description: 'Bing search crawler'                                                         },
  { id: 'msnbot',           name: 'MSNBot',           company: 'Microsoft',               type: 'search',     userAgent: 'msnbot'                                                                                                            },
  { id: 'bingpreview',      name: 'BingPreview',      company: 'Microsoft',               type: 'search',     userAgent: 'BingPreview'                                                                                                       },
  { id: 'adidxbot',         name: 'AdIdxBot',         company: 'Microsoft',               type: 'search',     userAgent: 'adidxbot'                                                                                                          },

  // ─── Perplexity ───────────────────────────────────────────────────────────
  { id: 'perplexitybot',    name: 'PerplexityBot',    company: 'Perplexity',              type: 'ai',         userAgent: 'PerplexityBot',         description: 'Perplexity AI web crawler'                                                   },
  { id: 'perplexity-ask',   name: 'Perplexity-Ask',   company: 'Perplexity',              type: 'ai',         userAgent: 'Perplexity-Ask'                                                                                                    },

  // ─── Meta / Facebook ──────────────────────────────────────────────────────
  { id: 'facebookbot',      name: 'FacebookBot',      company: 'Meta',                    type: 'social',     userAgent: 'facebookexternalhit',   description: 'Facebook link preview crawler'                                               },
  { id: 'meta-externalagent', name: 'Meta ExternalAgent', company: 'Meta',               type: 'ai',         userAgent: 'meta-externalagent'                                                                                                },
  { id: 'facebot',          name: 'Facebot',          company: 'Meta',                    type: 'social',     userAgent: 'Facebot'                                                                                                           },
  { id: 'whatsapp',         name: 'WhatsApp',         company: 'Meta',                    type: 'social',     userAgent: 'WhatsApp'                                                                                                          },

  // ─── Apple ────────────────────────────────────────────────────────────────
  { id: 'applebot',         name: 'Applebot',         company: 'Apple',                   type: 'search',     userAgent: 'Applebot',              description: 'Apple Siri & Spotlight crawler'                                              },
  { id: 'applebot-extended', name: 'Applebot-Extended', company: 'Apple',                type: 'ai',         userAgent: 'Applebot-Extended'                                                                                                 },

  // ─── Amazon ───────────────────────────────────────────────────────────────
  { id: 'amazonbot',        name: 'AmazonBot',        company: 'Amazon',                  type: 'scraper',    userAgent: 'AmazonBot'                                                                                                         },
  { id: 'amazon-adbot',     name: 'AmazonAdBot',      company: 'Amazon',                  type: 'scraper',    userAgent: 'AmazonAdBot'                                                                                                       },
  { id: 'alexa-mediabot',   name: 'Alexa Media Bot',  company: 'Amazon',                  type: 'scraper',    userAgent: 'alexamediabot'                                                                                                     },
  { id: 'ia-archiver',      name: 'ia_archiver',      company: 'Amazon/Alexa',            type: 'scraper',    userAgent: 'ia_archiver'                                                                                                       },

  // ─── Cohere ───────────────────────────────────────────────────────────────
  { id: 'cohere-ai',        name: 'cohere-ai',        company: 'Cohere',                  type: 'ai',         userAgent: 'cohere-ai'                                                                                                         },

  // ─── AI21 Labs ────────────────────────────────────────────────────────────
  { id: 'ai21-bot',         name: 'AI21Bot',          company: 'AI21 Labs',               type: 'ai',         userAgent: 'AI21'                                                                                                              },

  // ─── Allen Institute for AI ───────────────────────────────────────────────
  { id: 'ai2bot',           name: 'ai2bot',           company: 'Allen Institute for AI',  type: 'ai',         userAgent: 'ai2bot'                                                                                                            },
  { id: 'ai2bot-dolma',     name: 'AI2Bot-Dolma',     company: 'Allen Institute for AI',  type: 'ai',         userAgent: 'AI2Bot-Dolma'                                                                                                      },
  { id: 'ai2bot-deepresearch', name: 'AI2Bot-DeepResearch', company: 'Allen Institute for AI', type: 'ai',    userAgent: 'ai2bot-deepresearch'                                                                                               },

  // ─── Bytedance / TikTok ───────────────────────────────────────────────────
  { id: 'bytespider',       name: 'Bytespider',       company: 'ByteDance',               type: 'ai',         userAgent: 'Bytespider',            description: 'ByteDance/TikTok AI crawler'                                                 },
  { id: 'tiktokbot',        name: 'TikTokBot',        company: 'ByteDance',               type: 'social',     userAgent: 'TikTokBot'                                                                                                         },

  // ─── Twitter / X ──────────────────────────────────────────────────────────
  { id: 'twitterbot',       name: 'Twitterbot',       company: 'X (Twitter)',             type: 'social',     userAgent: 'Twitterbot'                                                                                                        },

  // ─── LinkedIn ─────────────────────────────────────────────────────────────
  { id: 'linkedinbot',      name: 'LinkedInBot',      company: 'LinkedIn',                type: 'social',     userAgent: 'LinkedInBot'                                                                                                       },

  // ─── Pinterest ────────────────────────────────────────────────────────────
  { id: 'pinterest',        name: 'Pinterest',        company: 'Pinterest',               type: 'social',     userAgent: 'Pinterest'                                                                                                         },

  // ─── Slack ────────────────────────────────────────────────────────────────
  { id: 'slackbot',         name: 'Slackbot',         company: 'Slack',                   type: 'social',     userAgent: 'Slackbot'                                                                                                          },

  // ─── Telegram ─────────────────────────────────────────────────────────────
  { id: 'telegrambot',      name: 'TelegramBot',      company: 'Telegram',                type: 'social',     userAgent: 'TelegramBot'                                                                                                       },

  // ─── Discord ──────────────────────────────────────────────────────────────
  { id: 'discordbot',       name: 'Discordbot',       company: 'Discord',                 type: 'social',     userAgent: 'Discordbot'                                                                                                        },

  // ─── Reddit ───────────────────────────────────────────────────────────────
  { id: 'redditbot',        name: 'Redditbot',        company: 'Reddit',                  type: 'social',     userAgent: 'redditbot'                                                                                                         },

  // ─── Snapchat ─────────────────────────────────────────────────────────────
  { id: 'snapchat',         name: 'Snapchat',         company: 'Snap',                    type: 'social',     userAgent: 'Snapchat'                                                                                                          },

  // ─── DuckDuckGo ───────────────────────────────────────────────────────────
  { id: 'duckduckbot',      name: 'DuckDuckBot',      company: 'DuckDuckGo',              type: 'search',     userAgent: 'DuckDuckBot'                                                                                                       },
  { id: 'duckduckgo-favicons', name: 'DuckDuckGo Favicons', company: 'DuckDuckGo',        type: 'search',     userAgent: 'DuckDuckGo-Favicons'                                                                                               },

  // ─── Yahoo ────────────────────────────────────────────────────────────────
  { id: 'yahoobot',         name: 'Yahoo Slurp',      company: 'Yahoo',                   type: 'search',     userAgent: 'Slurp'                                                                                                             },

  // ─── Baidu ────────────────────────────────────────────────────────────────
  { id: 'baiduspider',      name: 'Baiduspider',      company: 'Baidu',                   type: 'search',     userAgent: 'Baiduspider'                                                                                                       },
  { id: 'baidu-linkcrawler', name: 'Baidu-LinkCrawler', company: 'Baidu',                 type: 'search',     userAgent: 'Baiduspider-image'                                                                                                 },

  // ─── Yandex ───────────────────────────────────────────────────────────────
  { id: 'yandexbot',        name: 'YandexBot',        company: 'Yandex',                  type: 'search',     userAgent: 'YandexBot'                                                                                                         },
  { id: 'yandex-images',    name: 'YandexImages',     company: 'Yandex',                  type: 'search',     userAgent: 'YandexImages'                                                                                                      },
  { id: 'yandex-video',     name: 'YandexVideo',      company: 'Yandex',                  type: 'search',     userAgent: 'YandexVideo'                                                                                                       },
  { id: 'yandex-metrika',   name: 'YandexMetrika',    company: 'Yandex',                  type: 'search',     userAgent: 'YandexMetrika'                                                                                                     },

  // ─── Naver ────────────────────────────────────────────────────────────────
  { id: 'naverbot',         name: 'Naverbot',         company: 'Naver',                   type: 'search',     userAgent: 'Naverbot'                                                                                                          },
  { id: 'yeti',             name: 'Yeti',             company: 'Naver',                   type: 'search',     userAgent: 'Yeti'                                                                                                              },

  // ─── Sogou ────────────────────────────────────────────────────────────────
  { id: 'sogou-spider',     name: 'Sogou Spider',     company: 'Sogou',                   type: 'search',     userAgent: 'Sogou'                                                                                                             },

  // ─── Qwant ────────────────────────────────────────────────────────────────
  { id: 'qwantify',         name: 'Qwantify',         company: 'Qwant',                   type: 'search',     userAgent: 'Qwantify'                                                                                                          },

  // ─── Ecosia ───────────────────────────────────────────────────────────────
  { id: 'coccocbot',        name: 'coccocbot',        company: 'Cốc Cốc',                 type: 'search',     userAgent: 'coccocbot'                                                                                                         },

  // ─── Ahrefs ───────────────────────────────────────────────────────────────
  { id: 'ahrefsbot',        name: 'AhrefsBot',        company: 'Ahrefs',                  type: 'scraper',    userAgent: 'AhrefsBot',             description: 'SEO backlink analysis crawler',              website: 'https://ahrefs.com/robot' },

  // ─── Semrush ──────────────────────────────────────────────────────────────
  { id: 'semrushbot',       name: 'SemrushBot',       company: 'Semrush',                 type: 'scraper',    userAgent: 'SemrushBot'                                                                                                        },
  { id: 'semrushbot-sa',    name: 'SemrushBot-SA',    company: 'Semrush',                 type: 'scraper',    userAgent: 'SemrushBot-SA'                                                                                                     },
  { id: 'semrushbot-ba',    name: 'SemrushBot-BA',    company: 'Semrush',                 type: 'scraper',    userAgent: 'SemrushBot-BA'                                                                                                     },

  // ─── Moz ──────────────────────────────────────────────────────────────────
  { id: 'rogerbot',         name: 'Rogerbot',         company: 'Moz',                     type: 'scraper',    userAgent: 'rogerbot'                                                                                                          },
  { id: 'dotbot',           name: 'DotBot',           company: 'Moz',                     type: 'scraper',    userAgent: 'DotBot'                                                                                                            },

  // ─── Majestic ─────────────────────────────────────────────────────────────
  { id: 'majestic-12',      name: 'MJ12bot',          company: 'Majestic',                type: 'scraper',    userAgent: 'MJ12bot'                                                                                                           },

  // ─── Firecrawl ────────────────────────────────────────────────────────────
  { id: 'firecrawl',        name: 'Firecrawl',        company: 'Mendable',                type: 'scraper',    userAgent: 'Firecrawl',             description: 'LLM-optimised web scraping service',        website: 'https://firecrawl.dev'   },

  // ─── Bright Data ──────────────────────────────────────────────────────────
  { id: 'brightdata',       name: 'BrightData',       company: 'Bright Data',             type: 'scraper',    userAgent: 'BrightData',            description: 'Proxy-based scraping infrastructure'                                         },

  // ─── Oxylabs ──────────────────────────────────────────────────────────────
  { id: 'oxylabs',          name: 'Oxylabs',          company: 'Oxylabs',                 type: 'scraper',    userAgent: 'Oxylabs'                                                                                                           },

  // ─── ScrapingBee ──────────────────────────────────────────────────────────
  { id: 'scrapingbee',      name: 'ScrapingBee',      company: 'ScrapingBee',             type: 'scraper',    userAgent: 'ScrapingBee'                                                                                                       },

  // ─── ScraperAPI ───────────────────────────────────────────────────────────
  { id: 'scraperapi',       name: 'ScraperAPI',       company: 'ScraperAPI',              type: 'scraper',    userAgent: 'ScraperAPI'                                                                                                        },

  // ─── Zyte ─────────────────────────────────────────────────────────────────
  { id: 'zyte',             name: 'Zyte',             company: 'Zyte',                    type: 'scraper',    userAgent: 'Zyte'                                                                                                              },
  { id: 'scrapy',           name: 'Scrapy',           company: 'Scrapy (OSS)',             type: 'scraper',    userAgent: 'Scrapy'                                                                                                            },

  // ─── ZenRows ──────────────────────────────────────────────────────────────
  { id: 'zenrows',          name: 'ZenRows',          company: 'ZenRows',                 type: 'scraper',    userAgent: 'ZenRows'                                                                                                           },

  // ─── ScrapeStack ──────────────────────────────────────────────────────────
  { id: 'scrapestack',      name: 'ScrapeStack',      company: 'ScrapeStack',             type: 'scraper',    userAgent: 'ScrapeStack'                                                                                                       },

  // ─── ScrapeGraphAI ────────────────────────────────────────────────────────
  { id: 'scrapegraphai',    name: 'ScrapeGraphAI',    company: 'ScrapeGraph',             type: 'scraper',    userAgent: 'ScrapeGraph'                                                                                                       },

  // ─── Diffbot ──────────────────────────────────────────────────────────────
  { id: 'diffbot',          name: 'Diffbot',          company: 'Diffbot',                 type: 'scraper',    userAgent: 'Diffbot',               description: 'AI-powered data extraction service'                                          },

  // ─── Apify ────────────────────────────────────────────────────────────────
  { id: 'apify',            name: 'Apify',            company: 'Apify',                   type: 'scraper',    userAgent: 'ApifyBot'                                                                                                          },

  // ─── Archive.org / Wayback ────────────────────────────────────────────────
  { id: 'internetarchive',  name: 'Internet Archive', company: 'Internet Archive',        type: 'scraper',    userAgent: 'archive.org_bot',       description: 'Wayback Machine archiver'                                                    },
  { id: 'wayback',          name: 'Wayback',          company: 'Internet Archive',        type: 'scraper',    userAgent: 'Wayback'                                                                                                           },

  // ─── Common Crawl ─────────────────────────────────────────────────────────
  { id: 'ccbot',            name: 'CCBot',            company: 'Common Crawl',            type: 'ai',         userAgent: 'CCBot',                 description: 'Open dataset used by many AI training runs'                                  },

  // ─── DataForSEO ───────────────────────────────────────────────────────────
  { id: 'dataforseo',       name: 'DataForSEO',       company: 'DataForSEO',              type: 'scraper',    userAgent: 'DataForSeo'                                                                                                        },

  // ─── Screaming Frog ───────────────────────────────────────────────────────
  { id: 'screamingfrog',    name: 'Screaming Frog',   company: 'Screaming Frog',          type: 'scraper',    userAgent: 'Screaming Frog SEO Spider'                                                                                         },

  // ─── Similarweb ───────────────────────────────────────────────────────────
  { id: 'similarweb',       name: 'SimilarWeb',       company: 'SimilarWeb',              type: 'scraper',    userAgent: 'SimilarWeb'                                                                                                        },

  // ─── Sistrix ──────────────────────────────────────────────────────────────
  { id: 'sistrix',          name: 'SISTRIX',          company: 'SISTRIX',                 type: 'scraper',    userAgent: 'SISTRIX'                                                                                                           },

  // ─── SEO PowerSuite ───────────────────────────────────────────────────────
  { id: 'seo-powersuit',    name: 'SEO PowerSuite',   company: 'SEO PowerSuite',          type: 'scraper',    userAgent: 'SEO PowerSuite'                                                                                                    },

  // ─── Netcraft ─────────────────────────────────────────────────────────────
  { id: 'netcraft',         name: 'Netcraft',         company: 'Netcraft',                type: 'scraper',    userAgent: 'Netcraft'                                                                                                          },

  // ─── Petal Search ─────────────────────────────────────────────────────────
  { id: 'petalbot',         name: 'PetalBot',         company: 'Huawei',                  type: 'search',     userAgent: 'PetalBot'                                                                                                          },

  // ─── Seekport ─────────────────────────────────────────────────────────────
  { id: 'seekport',         name: 'Seekport',         company: 'Seekport',                type: 'search',     userAgent: 'Seekport'                                                                                                          },

  // ─── Mojeek ───────────────────────────────────────────────────────────────
  { id: 'mojeek',           name: 'MojeekBot',        company: 'Mojeek',                  type: 'search',     userAgent: 'MojeekBot'                                                                                                         },

  // ─── Brave ────────────────────────────────────────────────────────────────
  { id: 'bravebot',         name: 'Brave Search',     company: 'Brave',                   type: 'search',     userAgent: 'BraveBot'                                                                                                          },

  // ─── You.com ──────────────────────────────────────────────────────────────
  { id: 'youbot',           name: 'YouBot',           company: 'You.com',                 type: 'ai',         userAgent: 'YouBot'                                                                                                            },

  // ─── Mistral ──────────────────────────────────────────────────────────────
  { id: 'mistralai',        name: 'MistralAI-User',   company: 'Mistral AI',              type: 'ai',         userAgent: 'MistralAI'                                                                                                         },

  // ─── Stability AI ─────────────────────────────────────────────────────────
  { id: 'stabilitybot',     name: 'StabilityBot',     company: 'Stability AI',            type: 'ai',         userAgent: 'StabilityBot'                                                                                                      },

  // ─── Hugging Face ─────────────────────────────────────────────────────────
  { id: 'huggingface',      name: 'HuggingFaceBot',   company: 'Hugging Face',            type: 'ai',         userAgent: 'HuggingFaceBot'                                                                                                    },

  // ─── xAI / Grok ───────────────────────────────────────────────────────────
  { id: 'xai-grok',         name: 'Grokbot',          company: 'xAI',                     type: 'ai',         userAgent: 'Grokbot'                                                                                                           },

  // ─── Timpi ────────────────────────────────────────────────────────────────
  { id: 'timpibot',         name: 'TimpiBot',         company: 'Timpi',                   type: 'search',     userAgent: 'Timpibot'                                                                                                          },

  // ─── Bing / Microsoft 365 Copilot ─────────────────────────────────────────
  { id: 'copilot',          name: 'Microsoft Copilot', company: 'Microsoft',              type: 'ai',         userAgent: 'CopilotBot'                                                                                                        },

  // ─── Liner ────────────────────────────────────────────────────────────────
  { id: 'linerbot',         name: 'LinerBot',         company: 'Liner',                   type: 'ai',         userAgent: 'LinerBot'                                                                                                          },

  // ─── Webz.io ──────────────────────────────────────────────────────────────
  { id: 'webzio',           name: 'Webz.io Bot',      company: 'Webz.io',                 type: 'scraper',    userAgent: 'Webzio'                                                                                                            },

  // ─── Purebot ──────────────────────────────────────────────────────────────
  { id: 'purebot',          name: 'PureBot',          company: 'PureBot',                 type: 'scraper',    userAgent: 'PureBot'                                                                                                           },

  // ─── Adsbot ───────────────────────────────────────────────────────────────
  { id: 'adscanner',        name: 'AdScanner',        company: 'AdScanner',               type: 'scraper',    userAgent: 'adscanner'                                                                                                         },

  // ─── Conductor ────────────────────────────────────────────────────────────
  { id: 'conductor',        name: 'Conductor',        company: 'Conductor',               type: 'scraper',    userAgent: 'Conductor'                                                                                                         },

  // ─── Linkdex ──────────────────────────────────────────────────────────────
  { id: 'linkdex',          name: 'Linkdex',          company: 'Linkdex',                 type: 'scraper',    userAgent: 'linkdex'                                                                                                           },

  // ─── Uptimerobot ──────────────────────────────────────────────────────────
  { id: 'uptimerobot',      name: 'UptimeRobot',      company: 'UptimeRobot',             type: 'monitoring', userAgent: 'UptimeRobot',           description: 'Website uptime monitoring service'                                           },

  // ─── Pingdom ──────────────────────────────────────────────────────────────
  { id: 'pingdom',          name: 'Pingdom',          company: 'Pingdom',                 type: 'monitoring', userAgent: 'Pingdom'                                                                                                           },

  // ─── StatusCake ───────────────────────────────────────────────────────────
  { id: 'statuscake',       name: 'StatusCake',       company: 'StatusCake',              type: 'monitoring', userAgent: 'StatusCake'                                                                                                         },

  // ─── New Relic ────────────────────────────────────────────────────────────
  { id: 'newrelic',         name: 'New Relic',        company: 'New Relic',               type: 'monitoring', userAgent: 'New Relic'                                                                                                         },

  // ─── Datadog ──────────────────────────────────────────────────────────────
  { id: 'datadog',          name: 'Datadog',          company: 'Datadog',                 type: 'monitoring', userAgent: 'Datadog'                                                                                                           },

  // ─── Site24x7 ─────────────────────────────────────────────────────────────
  { id: 'site24x7',         name: 'Site24x7',         company: 'Site24x7',                type: 'monitoring', userAgent: 'Site24x7'                                                                                                          },

  // ─── Freshping ────────────────────────────────────────────────────────────
  { id: 'freshping',        name: 'Freshping',        company: 'Freshworks',              type: 'monitoring', userAgent: 'Freshping'                                                                                                          },

  // ─── Dynatrace ────────────────────────────────────────────────────────────
  { id: 'dynatrace',        name: 'Dynatrace',        company: 'Dynatrace',               type: 'monitoring', userAgent: 'Dynatrace'                                                                                                         },

  // ─── AppDynamics ──────────────────────────────────────────────────────────
  { id: 'appdynamics',      name: 'AppDynamics',      company: 'AppDynamics',             type: 'monitoring', userAgent: 'AppDynamics'                                                                                                        },

  // ─── GTmetrix ─────────────────────────────────────────────────────────────
  { id: 'gtmetrix',         name: 'GTmetrix',         company: 'GTmetrix',                type: 'monitoring', userAgent: 'GTmetrix'                                                                                                          },

  // ─── WebPageTest ──────────────────────────────────────────────────────────
  { id: 'webpagetest',      name: 'WebPageTest',      company: 'WebPageTest',             type: 'monitoring', userAgent: 'WebPageTest'                                                                                                        },

  // ─── Catchpoint ───────────────────────────────────────────────────────────
  { id: 'catchpoint',       name: 'Catchpoint',       company: 'Catchpoint',              type: 'monitoring', userAgent: 'Catchpoint'                                                                                                         },

  // ─── Fastly ───────────────────────────────────────────────────────────────
  { id: 'fastly',           name: 'Fastly',           company: 'Fastly',                  type: 'monitoring', userAgent: 'Fastly'                                                                                                            },

  // ─── Zabbix ───────────────────────────────────────────────────────────────
  { id: 'zabbix',           name: 'Zabbix',           company: 'Zabbix',                  type: 'monitoring', userAgent: 'Zabbix'                                                                                                            },

  // ─── WormlyBot ────────────────────────────────────────────────────────────
  { id: 'wormlybot',        name: 'Wormly',           company: 'Wormly',                  type: 'monitoring', userAgent: 'Wormly'                                                                                                            },

  // ─── RSS / Feed Readers ───────────────────────────────────────────────────
  { id: 'feedburner',       name: 'FeedBurner',       company: 'Google',                  type: 'scraper',    userAgent: 'FeedBurner'                                                                                                        },
  { id: 'feedfetcher',      name: 'FeedFetcher',      company: 'Google',                  type: 'scraper',    userAgent: 'FeedFetcher'                                                                                                        },
  { id: 'feedly',           name: 'Feedly',           company: 'Feedly',                  type: 'scraper',    userAgent: 'Feedly'                                                                                                            },
  { id: 'inoreader',        name: 'Inoreader',        company: 'Inoreader',               type: 'scraper',    userAgent: 'Inoreader'                                                                                                         },
  { id: 'newsblur',         name: 'NewsBlur',         company: 'NewsBlur',                type: 'scraper',    userAgent: 'NewsBlur'                                                                                                          },
  { id: 'netvibes',         name: 'Netvibes',         company: 'Netvibes',                type: 'scraper',    userAgent: 'Netvibes'                                                                                                          },

  // ─── Generic / Open-source ────────────────────────────────────────────────
  { id: 'wget',             name: 'Wget',             company: 'GNU',                     type: 'scraper',    userAgent: 'Wget'                                                                                                              },
  { id: 'curl',             name: 'curl',             company: 'Open Source',             type: 'scraper',    userAgent: 'curl'                                                                                                              },
  { id: 'python-requests',  name: 'python-requests',  company: 'Open Source',             type: 'scraper',    userAgent: 'python-requests'                                                                                                   },
  { id: 'python-urllib',    name: 'Python-urllib',    company: 'Open Source',             type: 'scraper',    userAgent: 'Python-urllib'                                                                                                     },
  { id: 'go-http-client',   name: 'Go http.Client',   company: 'Open Source',             type: 'scraper',    userAgent: 'Go-http-client'                                                                                                    },
  { id: 'httpclient',       name: 'Apache HttpClient', company: 'Apache',                 type: 'scraper',    userAgent: 'Apache-HttpClient'                                                                                                 },
  { id: 'java',             name: 'Java',             company: 'Oracle',                  type: 'scraper',    userAgent: 'Java'                                                                                                              },
  { id: 'libwww-perl',      name: 'libwww-perl',      company: 'Open Source',             type: 'scraper',    userAgent: 'libwww-perl'                                                                                                       },
  { id: 'mechanize',        name: 'Mechanize',        company: 'Open Source',             type: 'scraper',    userAgent: 'mechanize'                                                                                                         },
  { id: 'playwright',       name: 'Playwright',       company: 'Microsoft',               type: 'scraper',    userAgent: 'Playwright'                                                                                                        },
  { id: 'puppeteer',        name: 'Puppeteer',        company: 'Google',                  type: 'scraper',    userAgent: 'HeadlessChrome'                                                                                                    },

  // ─── AI Training Crawlers ─────────────────────────────────────────────────
  { id: 'omgili',           name: 'Omgilibot',        company: 'Webz.io',                 type: 'ai',         userAgent: 'Omgilibot'                                                                                                         },
  { id: 'datasets-server',  name: 'Datasets Server',  company: 'Hugging Face',            type: 'ai',         userAgent: 'datasets-server'                                                                                                   },
  { id: 'scrapy-ml',        name: 'ML Scraper',       company: 'Various',                 type: 'ai',         userAgent: 'MLBot'                                                                                                             },
  { id: 'iaskspider',       name: 'iAsk Spider',      company: 'iAsk.ai',                 type: 'ai',         userAgent: 'iaskspider'                                                                                                        },
  { id: 'safeassign',       name: 'SafeAssign',       company: 'Blackboard',              type: 'ai',         userAgent: 'SafeAssign'                                                                                                        },
  { id: 'turnitin',         name: 'Turnitin',         company: 'Turnitin',                type: 'ai',         userAgent: 'Turnitin'                                                                                                          },
  { id: 'neeva',            name: 'Neeva Bot',        company: 'Neeva',                   type: 'ai',         userAgent: 'Neevabot'                                                                                                          },
  { id: 'spinner-browser',  name: 'SpinnerBot',       company: 'Spinner.io',              type: 'ai',         userAgent: 'Spinner'                                                                                                           },

  // ─── Price Comparison / Shopping ──────────────────────────────────────────
  { id: 'googleshoppingbot', name: 'Google Shopping', company: 'Google',                  type: 'scraper',    userAgent: 'GoogleProducer'                                                                                                    },
  { id: 'pricespy',         name: 'PriceSpy',         company: 'PriceSpy',                type: 'scraper',    userAgent: 'PriceSpy'                                                                                                          },
  { id: 'pricerunner',      name: 'PriceRunner',      company: 'PriceRunner',             type: 'scraper',    userAgent: 'PriceRunner'                                                                                                       },
  { id: 'kelkoo',           name: 'Kelkoo',           company: 'Kelkoo',                  type: 'scraper',    userAgent: 'Kelkoo'                                                                                                            },

  // ─── Security / Vulnerability ─────────────────────────────────────────────
  { id: 'nessus',           name: 'Nessus',           company: 'Tenable',                 type: 'monitoring', userAgent: 'Nessus'                                                                                                            },
  { id: 'burpsuite',        name: 'Burp Suite',       company: 'PortSwigger',             type: 'monitoring', userAgent: 'BurpSuite'                                                                                                         },
  { id: 'nikto',            name: 'Nikto',            company: 'Open Source',             type: 'monitoring', userAgent: 'Nikto'                                                                                                             },
  { id: 'masscan',          name: 'masscan',          company: 'Open Source',             type: 'monitoring', userAgent: 'masscan'                                                                                                           },

  // ─── Translation / Localisation ───────────────────────────────────────────
  { id: 'google-translate',  name: 'Google Translate', company: 'Google',                 type: 'scraper',    userAgent: 'Google-Translate'                                                                                                  },
  { id: 'deepl',             name: 'DeepL',            company: 'DeepL',                  type: 'ai',         userAgent: 'DeepL'                                                                                                             },

  // ─── Accessibility ────────────────────────────────────────────────────────
  { id: 'accessibot',       name: 'AccessiBot',       company: 'accessiBe',               type: 'monitoring', userAgent: 'accessibot'                                                                                                        },
  { id: 'siteimprove',      name: 'Siteimprove',      company: 'Siteimprove',             type: 'monitoring', userAgent: 'Siteimprove'                                                                                                       },

  // ─── Marketing / CRM ──────────────────────────────────────────────────────
  { id: 'hubspot',          name: 'HubSpot',          company: 'HubSpot',                 type: 'scraper',    userAgent: 'HubSpot'                                                                                                           },
  { id: 'mailchimp',        name: 'Mailchimp',        company: 'Mailchimp',               type: 'scraper',    userAgent: 'Mailchimp'                                                                                                         },
  { id: 'salesforce',       name: 'Salesforce',       company: 'Salesforce',              type: 'scraper',    userAgent: 'Salesforce'                                                                                                        },

  // ─── Content / Media ──────────────────────────────────────────────────────
  { id: 'outbrain',         name: 'Outbrain',         company: 'Outbrain',                type: 'scraper',    userAgent: 'Outbrain'                                                                                                          },
  { id: 'taboola',          name: 'Taboola',          company: 'Taboola',                 type: 'scraper',    userAgent: 'Taboola'                                                                                                           },

  // ─── Academic ─────────────────────────────────────────────────────────────
  { id: 'semanticscholar',  name: 'Semantic Scholar',  company: 'Allen Institute for AI', type: 'ai',         userAgent: 'SemanticScholarBot'                                                                                                },

  // ─── Browser extensions / Summaries ───────────────────────────────────────
  { id: 'ezoic',            name: 'Ezoic',            company: 'Ezoic',                   type: 'scraper',    userAgent: 'Ezoic'                                                                                                             },
  { id: 'summarizebot',     name: 'SummarizeBot',     company: 'SummarizeBot',            type: 'ai',         userAgent: 'SummarizeBot'                                                                                                      },
  { id: 'tldrbot',          name: 'TLDRBot',          company: 'TLDR.tech',               type: 'ai',         userAgent: 'TLDRBot'                                                                                                           },
  { id: 'readerbot',        name: 'ReaderBot',        company: 'Reader',                  type: 'ai',         userAgent: 'ReaderBot'                                                                                                         },
  { id: 'jina-reader',      name: 'JinaReader',       company: 'Jina AI',                 type: 'ai',         userAgent: 'JinaReader',            description: 'Jina AI r.jina.ai reader/crawler'                                            },
  { id: 'firecrawl-reader', name: 'Firecrawl Reader', company: 'Mendable',                type: 'ai',         userAgent: 'Firecrawl-reader'                                                                                                  },

  // ─── Nimble ───────────────────────────────────────────────────────────────
  { id: 'nimblebot',        name: 'NimbleBot',        company: 'Nimble',                  type: 'scraper',    userAgent: 'Nimble'                                                                                                            },

  // ─── Velvet Underground ───────────────────────────────────────────────────
  { id: 'scrapingant',      name: 'ScrapingAnt',      company: 'ScrapingAnt',             type: 'scraper',    userAgent: 'ScrapingAnt'                                                                                                       },

  // ─── GoodBot / BadBot ─────────────────────────────────────────────────────
  { id: 'safedns',          name: 'SafeDNS',          company: 'SafeDNS',                 type: 'monitoring', userAgent: 'SafeDNS'                                                                                                           },

  // ─── WebDAV / Miscellaneous ───────────────────────────────────────────────
  { id: 'microsoft-office', name: 'Microsoft Office',  company: 'Microsoft',              type: 'scraper',    userAgent: 'Microsoft Office'                                                                                                  },
  { id: 'apache-nutch',     name: 'Apache Nutch',     company: 'Apache',                  type: 'scraper',    userAgent: 'Nutch'                                                                                                             },
  { id: 'heritrix',         name: 'Heritrix',         company: 'Internet Archive',        type: 'scraper',    userAgent: 'Heritrix'                                                                                                          },
  { id: 'larbin',           name: 'larbin',           company: 'Open Source',             type: 'scraper',    userAgent: 'larbin'                                                                                                            },
  { id: 'lwp-trivial',      name: 'LWP::Simple',      company: 'Open Source',             type: 'scraper',    userAgent: 'lwp-trivial'                                                                                                       },
  { id: 'rssbot',           name: 'RSS Bot',          company: 'Various',                 type: 'scraper',    userAgent: 'rss'                                                                                                               },

  // ─── Additional AI Crawlers ────────────────────────────────────────────────
  { id: 'gpt-researcher',   name: 'GPT-Researcher',   company: 'Assaf Elovic',            type: 'ai',         userAgent: 'GPT-Researcher'                                                                                                    },
  { id: 'meta-ai',          name: 'Meta AI',          company: 'Meta',                    type: 'ai',         userAgent: 'meta-ai'                                                                                                           },
  { id: 'ibm-watson',       name: 'IBM Watson',       company: 'IBM',                     type: 'ai',         userAgent: 'IBM_Watson'                                                                                                        },
  { id: 'writesonic',       name: 'Writesonic',       company: 'Writesonic',              type: 'ai',         userAgent: 'Writesonic'                                                                                                        },
  { id: 'jasper-ai',        name: 'Jasper AI',        company: 'Jasper',                  type: 'ai',         userAgent: 'Jasper'                                                                                                            },
  { id: 'copy-ai',          name: 'Copy.ai',          company: 'Copy.ai',                 type: 'ai',         userAgent: 'CopyAI'                                                                                                            },
  { id: 'character-ai',     name: 'Character.AI',     company: 'Character.AI',            type: 'ai',         userAgent: 'CharacterAI'                                                                                                       },
  { id: 'inflection-pi',    name: 'Inflection Pi',    company: 'Inflection AI',           type: 'ai',         userAgent: 'Inflection'                                                                                                        },
  { id: 'tavily',           name: 'Tavily',           company: 'Tavily',                  type: 'ai',         userAgent: 'Tavily'                                                                                                            },
  { id: 'linkup',           name: 'LinkUp',           company: 'LinkUp',                  type: 'ai',         userAgent: 'LinkUp'                                                                                                            },

  // ─── Additional Search Engines ────────────────────────────────────────────
  { id: 'ask-jeeves',       name: 'Teoma',            company: 'Ask.com',                 type: 'search',     userAgent: 'Teoma'                                                                                                             },
  { id: 'exabot',           name: 'Exabot',           company: 'Exalead',                 type: 'search',     userAgent: 'Exabot'                                                                                                            },
  { id: 'swiftbot',         name: 'SwiftBot',         company: 'SwiftBot',                type: 'search',     userAgent: 'SwiftBot'                                                                                                          },
  { id: 'baidumobilegame',  name: 'Baidu Mobile',     company: 'Baidu',                   type: 'search',     userAgent: 'Baidumobilegame'                                                                                                   },

  // ─── Additional Scrapers ──────────────────────────────────────────────────
  { id: 'httrack',          name: 'HTTrack',          company: 'HTTrack',                 type: 'scraper',    userAgent: 'HTTrack'                                                                                                           },
  { id: 'webcopier',        name: 'WebCopier',        company: 'WebCopier',               type: 'scraper',    userAgent: 'WebCopier'                                                                                                         },
  { id: 'teleport-pro',     name: 'Teleport Pro',     company: 'Tennyson Maxwell',        type: 'scraper',    userAgent: 'Teleport'                                                                                                          },
  { id: 'getright',         name: 'GetRight',         company: 'Headlight Software',      type: 'scraper',    userAgent: 'GetRight'                                                                                                          },
  { id: 'spider-monkey',    name: 'SpiderMonkey',     company: 'Open Source',             type: 'scraper',    userAgent: 'SpiderMonkey'                                                                                                      },
  { id: 'voil',             name: 'Voilabot',         company: 'Orange',                  type: 'search',     userAgent: 'Voilabot'                                                                                                          },
  { id: 'turnitinbot',      name: 'TurnitinBot',      company: 'Turnitin',                type: 'ai',         userAgent: 'TurnitinBot'                                                                                                       },
  { id: 'zoominfobot',      name: 'ZoomInfoBot',      company: 'ZoomInfo',                type: 'scraper',    userAgent: 'ZoomInfo'                                                                                                          },
  { id: 'spambot-catch',    name: 'SpamBot Catcher',  company: 'Various',                 type: 'monitoring', userAgent: 'spambot'                                                                                                           },
  { id: 'netpeek',          name: 'NetPeek',          company: 'NetPeek',                 type: 'monitoring', userAgent: 'NetPeek'                                                                                                           },
  { id: 'insideout',        name: 'InsideOut',        company: 'InsideOut',               type: 'scraper',    userAgent: 'InsideOut'                                                                                                         },
  { id: 'webbot',           name: 'WebBot',           company: 'WebBot',                  type: 'scraper',    userAgent: 'WebBot'                                                                                                            },

];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Match a raw User-Agent string against the database. Returns first match. */
export function getBotByUserAgent(rawUA: string): BotEntry | undefined {
  const ua = rawUA.toLowerCase();
  return BOT_DATABASE.find(bot => ua.includes(bot.userAgent.toLowerCase()));
}

/** Filter by type. */
export function getBotsByType(type: BotType): BotEntry[] {
  return BOT_DATABASE.filter(bot => bot.type === type);
}

/** Full-text search across name, company, userAgent. */
export function searchBots(query: string): BotEntry[] {
  const q = query.toLowerCase();
  return BOT_DATABASE.filter(bot =>
    bot.name.toLowerCase().includes(q) ||
    bot.company.toLowerCase().includes(q) ||
    bot.userAgent.toLowerCase().includes(q) ||
    (bot.description ?? '').toLowerCase().includes(q),
  );
}

/** Count bots by type. */
export function getBotCounts(): Record<BotType | 'total', number> {
  const counts = { total: BOT_DATABASE.length, ai: 0, scraper: 0, search: 0, social: 0, monitoring: 0 };
  for (const bot of BOT_DATABASE) counts[bot.type]++;
  return counts;
}
