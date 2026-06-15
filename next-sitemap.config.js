/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || "https://31-32peptides.com",
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/order/confirmation"],
      },
    ],
  },
  exclude: ["/api/*", "/admin/*", "/order/confirmation"],
  changefreq: "weekly",
  priority: 0.7,
  sitemapSize: 7000,
};
