class ExportTemplates {
  static buildHtml(listing, generation) {
    const highlights = Array.isArray(generation.highlights) ? generation.highlights : [];
    const highlightItems = highlights
      .map((h) => `<li style="margin-bottom:8px; padding-left:8px;">✓ ${h}</li>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${generation.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      color: #2c2c2c;
      max-width: 750px;
      margin: 0 auto;
      padding: 40px 30px;
      background: #fff;
      line-height: 1.6;
    }
    .header {
      border-bottom: 3px solid #c9a96e;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .badge {
      background: #c9a96e;
      color: white;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 11px;
      letter-spacing: 1px;
      text-transform: uppercase;
      display: inline-block;
      margin-bottom: 12px;
      font-family: Arial, sans-serif;
    }
    h1 {
      color: #1a1a2e;
      font-size: 22px;
      margin-bottom: 12px;
      line-height: 1.3;
    }
    .hook {
      font-size: 15px;
      color: #666;
      font-style: italic;
      line-height: 1.6;
    }
    .section { margin-bottom: 28px; }
    .section-label {
      font-family: Arial, sans-serif;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #c9a96e;
      margin-bottom: 10px;
      font-weight: bold;
    }
    .description { font-size: 14px; line-height: 1.85; color: #444; }
    .highlights-box {
      background: #faf7f2;
      border-left: 4px solid #c9a96e;
      padding: 20px 20px 20px 24px;
    }
    .highlights-box ul {
      list-style: none;
      padding: 0;
      font-size: 14px;
      color: #444;
    }
    .practical-box {
      background: #f4f6f9;
      padding: 16px 20px;
      border-radius: 6px;
      font-size: 14px;
      color: #555;
    }
    .score-bar {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .score-label { font-size: 12px; color: #999; font-family: Arial, sans-serif; }
    .score-value {
      font-size: 16px;
      font-weight: bold;
      color: ${generation.score >= 70 ? '#27ae60' : generation.score >= 50 ? '#f39c12' : '#e74c3c'};
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 11px;
      color: #bbb;
      font-family: Arial, sans-serif;
      border-top: 1px solid #f0f0f0;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="badge">Annonce Immobilière</span>
    <h1>${generation.title}</h1>
    <p class="hook">${generation.hook}</p>
  </div>

  <div class="section">
    <div class="section-label">Description</div>
    <p class="description">${generation.description}</p>
  </div>

  ${highlightItems ? `
  <div class="section">
    <div class="section-label">Points forts</div>
    <div class="highlights-box">
      <ul>${highlightItems}</ul>
    </div>
  </div>` : ''}

  ${generation.practicalInfo ? `
  <div class="section">
    <div class="section-label">Informations pratiques</div>
    <div class="practical-box">${generation.practicalInfo}</div>
  </div>` : ''}

  <div class="score-bar">
    <span class="score-label">Score qualité:</span>
    <span class="score-value">${generation.score}/100</span>
  </div>

  <div class="footer">
    Annonce générée par ImmoPro Swiss &nbsp;·&nbsp; ${new Date().toLocaleDateString('fr-CH')}
    &nbsp;·&nbsp; ${listing.location}
  </div>
</body>
</html>`;
  }

  static buildPlainText(listing, generation) {
    const highlights = Array.isArray(generation.highlights) ? generation.highlights : [];
    return [
      generation.title,
      '',
      generation.hook,
      '',
      generation.description,
      '',
      highlights.length > 0 ? 'Points forts:' : '',
      ...highlights.map((h) => `• ${h}`),
      '',
      generation.practicalInfo ?? '',
      '',
      `Score qualité: ${generation.score}/100`,
      `Localisation: ${listing.location}`,
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n');
  }
}

export default ExportTemplates;