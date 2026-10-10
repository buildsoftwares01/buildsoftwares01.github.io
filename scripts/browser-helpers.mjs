export async function openChapter(page, hash) {
  const menu = page.locator('#page-menu');
  if (!(await menu.evaluate(el => el.open))) await menu.locator('summary').click();
  await menu.locator(`a[href="${hash}"]`).click();
}
