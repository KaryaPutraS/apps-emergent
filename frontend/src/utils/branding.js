export const applyBrandingToDocument = ({ siteName, faviconDataUrl } = {}) => {
  if (siteName) document.title = siteName;
  if (faviconDataUrl) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconDataUrl;
  }
};
