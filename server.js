async function crawlSite(startUrl) {
    const allPageResults = [];
    const siteOrigin = new URL(startUrl).origin;

    // Fetch and analyze the homepage first
    const homePageHtml = await fetchHtml(startUrl);
    const homePageDom = new JSDOM(homePageHtml, { url: startUrl });
    const homePageDoc = homePageDom.window.document;
    allPageResults.push({ url: startUrl, checks: runAllChecks(homePageDoc, startUrl) });

    const crawledUrls = new Set([startUrl]);
    const menuUrlsToCrawl = findMenuLinks(homePageDoc, startUrl, crawledUrls).slice(0, 9); // Limit to 9 additional pages

    // Create an array of promises for fetching and parsing all secondary pages
    const pagePromises = menuUrlsToCrawl.map(async (url) => {
        if (crawledUrls.has(url)) return null;
        crawledUrls.add(url);
        try {
            const pageHtml = await fetchHtml(url);
            const pageDom = new JSDOM(pageHtml, { url: url });
            const pageDoc = pageDom.window.document;
            return { url: url, checks: runAllChecks(pageDoc, url) };
        } catch (error) {
            console.error(`Failed to crawl menu page ${url}:`, error.message);
            return null; // Return null on failure to avoid breaking Promise.all
        }
    });

    // Await all promises to resolve concurrently
    const additionalResults = (await Promise.all(pagePromises)).filter(result => result !== null);

    // Combine homepage results with the concurrent results
    const finalResults = allPageResults.concat(additionalResults);

    return processResults(finalResults);
}