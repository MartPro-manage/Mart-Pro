import html2canvas from 'html2canvas';

const MODERN_COLOR_REGEX = /(?:oklch|oklab|lab|lch|hwb|color)\([^)]+\)/gi;

const isUnsupportedColor = (val: string | null | undefined): boolean => {
  if (!val) return false;
  return /oklch|oklab|lab|lch|hwb|color\(/i.test(val);
};

/**
 * Safely captures an HTML element to a canvas using html2canvas,
 * stripping/converting any modern CSS "oklch(...)", "oklab(...)" color declarations in the cloned DOM
 * to prevent parsing crashes in html2canvas.
 */
export const captureElementToCanvas = async (element: HTMLElement) => {
  return await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (clonedDoc) => {
      // 1. Sanitize all <style> elements in cloned DOM
      const styleElements = clonedDoc.querySelectorAll('style');
      styleElements.forEach((styleTag) => {
        if (styleTag.textContent && isUnsupportedColor(styleTag.textContent)) {
          styleTag.textContent = styleTag.textContent.replace(MODERN_COLOR_REGEX, '#0f172a');
        }
      });

      // 2. Sanitize all accessible stylesheets in cloned DOM
      try {
        const styleSheets = Array.from(clonedDoc.styleSheets);
        styleSheets.forEach((sheet) => {
          try {
            const rules = sheet.cssRules;
            if (rules) {
              for (let i = 0; i < rules.length; i++) {
                const rule = rules[i] as CSSStyleRule;
                if (rule && rule.style && rule.style.cssText && isUnsupportedColor(rule.style.cssText)) {
                  rule.style.cssText = rule.style.cssText.replace(MODERN_COLOR_REGEX, '#0f172a');
                }
              }
            }
          } catch (_) {
            // cross-origin or restricted stylesheet
          }
        });
      } catch (_) {}

      // 3. Sanitize inline style attributes and computed styles on all cloned nodes
      const allElements = clonedDoc.querySelectorAll('*');
      allElements.forEach((node) => {
        const htmlEl = node as HTMLElement;

        // Clean inline style attribute if present
        const styleAttr = htmlEl.getAttribute('style');
        if (styleAttr && isUnsupportedColor(styleAttr)) {
          htmlEl.setAttribute('style', styleAttr.replace(MODERN_COLOR_REGEX, '#0f172a'));
        }

        // Clean inline style properties if computed in oklab / oklch
        try {
          const defaultView = clonedDoc.defaultView || window;
          const computed = defaultView.getComputedStyle(htmlEl);

          if (isUnsupportedColor(computed.color)) {
            htmlEl.style.color = '#0f172a';
          }
          if (isUnsupportedColor(computed.backgroundColor)) {
            htmlEl.style.backgroundColor = '#ffffff';
          }
          if (isUnsupportedColor(computed.borderColor)) {
            htmlEl.style.borderColor = '#cbd5e1';
          }
          if (isUnsupportedColor(computed.boxShadow)) {
            htmlEl.style.boxShadow = 'none';
          }
          if (isUnsupportedColor(computed.outlineColor)) {
            htmlEl.style.outlineColor = 'transparent';
          }
        } catch (_) {}
      });
    }
  });
};
