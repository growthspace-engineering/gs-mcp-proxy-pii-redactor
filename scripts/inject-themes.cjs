#!/usr/bin/env node

/**
 * Kibibit Theme Injector for Test Reports
 *
 * This script injects custom themes into Jest-stare and Istanbul coverage reports.
 * It modifies the HTML files to include the remote theme files from kibibit.io.
 *
 * Usage: node inject-themes.js [test-results-directory] [project-name]
 * If no directory is provided, defaults to './test-results'
 * If no project name is provided, defaults to the directory name
 */
const fs = require('fs');
const path = require('path');

// Get the input directory from command line argument or use default
const inputDir = process.argv[2] || './test-results';

// Get project name from argument or use directory name as fallback
const projectName = process.argv[3] ||
                    path.basename(path.resolve(inputDir));

const isVerboseMode = process.env.GITHUB_ACTIONS === 'true';

// Configuration
const config = {
  // Remote theme URLs
  themeUrls: {
    variables: 'https://kibibit.io/kibibit-assets/jest-stare/kb-jest-theme-variables.css',
    custom: 'https://kibibit.io/kibibit-assets/jest-stare/kb-jest-custom-theme.css',
    coverage: 'https://kibibit.io/kibibit-assets/jest-stare/kb-jest-coverage-theme.css',
    script: 'https://kibibit.io/kibibit-assets/jest-stare/kb-jest-custom-theme.js'
  }
};

/**
 * Removes existing theme script tag from an HTML file
 */
function removeExistingScriptTag(html) {
  // Find any existing theme script tag
  const scriptRegex = /<script[^>]*kb-jest-custom-theme\.js[^>]*><\/script>/g;
  return html.replace(scriptRegex, '');
}

/**
 * Injects a data-attribute with project name to the body tag
 */
function injectProjectNameAttribute(html, projectName) {
  // Handle case with existing body tag with attributes
  const bodyWithAttrRegex = /<body([^>]*)>/;
  if (bodyWithAttrRegex.test(html)) {
    return html.replace(bodyWithAttrRegex,
      `<body$1 data-project-name="${ projectName }">`);
  }

  // Handle case with simple body tag
  const bodyRegex = /<body>/;
  if (bodyRegex.test(html)) {
    return html.replace(bodyRegex,
      `<body data-project-name="${ projectName }">`);
  }

  return html;
}

/**
 * Injects the script tag and CSS styles into an HTML file
 */
function injectScriptToHTML(htmlFile) {
  const filePath = path.resolve(htmlFile);
  try {
    let html = fs.readFileSync(filePath, 'utf8');

    // Remove any existing script tag
    html = removeExistingScriptTag(html);

    // Remove any existing injected styles
    html = html.replace(
      /<style id="kb-injected-styles">[\s\S]*?<\/style>/,
      ''
    );

    // Remove any existing link tags for our theme files
    html = html.replace(
      /<link[^>]*kb-jest[^>]*>/g,
      ''
    );

    // Find the closing head tag
    const headCloseIndex = html.indexOf('</head>');
    if (headCloseIndex === -1) {
      throw new Error('Could not find </head> tag');
    }

    // Create link tags for remote CSS files (split to avoid linter warnings)
    const themeUrls = config.themeUrls;
    const variablesLink =
      `<link href="${ themeUrls.variables }" rel="stylesheet">`;
    const coverageLink =
      `<link href="${ themeUrls.coverage }" rel="stylesheet">`;
    const customLink =
      `<link href="${ themeUrls.custom }" rel="stylesheet">`;
    const styleLinks = variablesLink + '\n' + coverageLink + '\n' + customLink;

    // Add script tag for remote JS
    const scriptTag = `<script src="${ config.themeUrls.script }"></script>`;

    // Inject style links and script
    let newHtml = html.slice(0, headCloseIndex) +
                  styleLinks +
                  scriptTag +
                  html.slice(headCloseIndex);

    // Inject project name as data attribute to body tag
    newHtml = injectProjectNameAttribute(newHtml, projectName);

    fs.writeFileSync(filePath, newHtml, 'utf8');

    verbose(`✅ Injected remote styles and script into ${ htmlFile }`);

  } catch (err) {
    console.error(`❌ Error injecting into ${ htmlFile }: ${ err.message }`);
  }
}

/**
 * Find all HTML files in directory and subdirectories
 */
function findAllHtmlFiles(directory) {
  const results = [];

  function _findHtmlFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        _findHtmlFiles(fullPath);
      } else if (file.endsWith('.html')) {
        results.push(fullPath);
      }
    }
  }

  _findHtmlFiles(directory);

  return results;
}

/**
 * Main function
 */
async function main() {
  verbose('🚀 Starting Kibibit Theme Injector (Remote Mode)');
  verbose(`📁 Target directory: ${ inputDir }`);
  verbose(`📊 Project name: ${ projectName }`);

  // Check if input directory exists
  if (!fs.existsSync(inputDir)) {
    console.error(`❌ Directory not found: ${ inputDir }`);
    process.exit(1);
  }

  // Find all HTML files recursively
  verbose('🔍 Finding all HTML files in the directory...');
  const htmlFiles = findAllHtmlFiles(inputDir);
  verbose(`Found ${ htmlFiles.length } HTML files`);

  if (htmlFiles.length === 0) {
    console.warn('⚠️ No HTML files found to process');
    process.exit(0);
  }

  // Inject styles into all HTML files
  verbose('💉 Injecting remote styles into all HTML files...');
  htmlFiles.forEach((file) => {
    injectScriptToHTML(file);
  });

  verbose('✨ Theme injection complete!');
}

// Run the script
main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

function verbose(message) {
  if (isVerboseMode) {
    console.log(message);
  }
}
