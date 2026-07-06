# 🛡️ RedactAI (Chrome Extension)

RedactAI is a powerful, privacy-first Chrome Extension designed to seamlessly intercept file uploads on popular AI chatbots (like ChatGPT, Claude, and Gemini), scan them for Personally Identifiable Information (PII), and allow you to sanitize the document before it ever leaves your browser. 

This ensures that sensitive information such as Names, Emails, Phone Numbers, and SSNs are never accidentally leaked to external LLM providers.

## ✨ Features

- **Universal Interception**: Automatically catches `.txt` and `.pdf` files uploaded via file dialog, drag-and-drop, or clipboard paste on supported AI platforms.
- **Client-Side Processing**: Fully local text extraction and PII detection. No data is sent to external servers for processing.
- **Interactive Redaction Dashboard**:
  - View a complete list of detected PII.
  - See confidence scores for each detection.
  - Hover over highlighted text to see the matched entity type.
  - Grouped Category Dropdowns (e.g. click "3x EMAIL" to see all emails and bulk redact/unredact).
- **Manual Redaction**: Highlight any missed sensitive word in the preview window to manually lock it down.
- **Direct Chat Injection**: One-click "Paste to Chat" button to insert the sanitized text directly into the AI's prompt box.
- **Document Export**: Download the sanitized text as a `.txt` or a nicely formatted `.pdf` document.

## 🏗️ Architecture (Mock Backend)

RedactAI is currently built with a purely **client-side architecture** using a mock detection engine. It does not rely on heavy NLP models or external Python backends, ensuring lightning-fast execution and zero data transmission.

### Flow Diagram

1. **Content Script Injection** (`content.js`): Injected into AI chat websites to monitor DOM events (change, drop, paste).
2. **File Extraction** (`extractor.js`): Uses `pdf.js` to parse PDFs into plain text entirely within the browser.
3. **PII Detection Engine** (`piiDetector.js`):
   - Uses strict, optimized regular expressions to identify standard PII (Emails, Phones, SSNs).
   - Includes a **Smart Context Validator** and a **Common First-Name Dictionary** to accurately identify human names while filtering out generic corporate document headings (e.g., "Business Overview").
4. **UI Rendering** (`content.css` & DOM creation): Generates a floating glassmorphism dashboard overlay injected directly into the host page.
5. **PDF Export** (`jsPDF`): Generates sanitized `.pdf` files on the fly.

## 🛠️ Development & Build Instructions

### Prerequisites
- Node.js (v14+)
- npm

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Acid-Rebel/RedactAI.git
   cd RedactAI
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```
   *(Alternatively, run `npx webpack --mode production`)*

### Loading into Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `dist` folder located inside the `RedactAI` directory.
4. Navigate to an AI chat site (e.g., `chatgpt.com`), drop a PDF, and the RedactAI dashboard will appear!

## 📦 Tech Stack

- **Extension Framework**: Chrome Manifest V3
- **Bundler**: Webpack 5
- **File Parsing**: PDF.js (`pdfjs-dist`)
- **PDF Generation**: jsPDF
- **Styling**: Vanilla CSS (Glassmorphism design)
