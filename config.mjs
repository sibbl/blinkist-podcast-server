export default {
  languages: ["de", "en"],
  // Uncomment the block below to limit how many episodes are kept per locale
  // episodesToKeep: {
  //   de: 30, // keep the latest 30 German episodes
  //   en: 20  // keep the latest 20 English episodes
  // },
  episodesToKeep: {},
  headless: true,
  scrapeParallel: false,
  scraperCron: "*/60 * * * *",
  port: 8080,
  feedPageSize: 50
};
