<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" omit-xml-declaration="yes" indent="no"/>
  <xsl:strip-space elements="*"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>FAR</title>
        <link rel="stylesheet" href="vendor/js-treeview.min.css"/>
        <script src="vendor/js-treeview.min.js"></script>
        <style>
          body { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 1.2rem; color: #111827; }
          #layout { display: flex; min-height: 100vh; }
          #sidebar { width: 320px; min-width: 320px; box-sizing: border-box; border-right: 1px solid #d1d5db; background: #f8fafc; padding: 0.8rem 0.9rem; overflow-y: auto; }
          #main { flex: 1; min-width: 0; padding: 1rem 1.2rem; }
          #meta { margin-bottom: 0.9rem; font-size: 1rem; color: #374151; line-height: 1.4; }
          #toc, #toc ul { list-style: none; margin: 0; padding: 0; }
          #toc li { margin: 0.25rem 0; }
          #toc a { color: #0f4f9b; text-decoration: none; }
          #toc a:hover { text-decoration: underline; }
          .toc-part-title { font-weight: 700; }
          .toc-subpart-title { margin-top: 0.45rem; margin-left: 0.65rem; font-weight: 600; color: #334155; }
          .toc-subjgrp-title { margin-top: 0.2rem; margin-left: 1.25rem; font-style: italic; color: #475569; }
          .toc-section { margin-left: 1.25rem; }
          .toc-subjgrp-section { margin-left: 1.85rem; }
          h1 { margin: 0.2rem 0 0.5rem 0; font-size: 1.65rem; }
          h2 { margin: 1rem 0 0.45rem 0; font-size: 1.28rem; }
          h3 { margin: 0.8rem 0 0.4rem 0; font-size: 1.12rem; }
          h4 { margin: 0.7rem 0 0.35rem 0; font-size: 1.05rem; }
          .meta-line { margin-bottom: 0.2rem; }
          .authority { margin: 0.85rem 0; font-size: 1.1rem; color: #1f2937; }
          .authority .label { font-weight: 700; }
          .section { margin: 1rem 0 1.35rem 0; }
          .section-title { margin: 0 0 0.35rem 0; font-size: 1.15rem; font-weight: 700; }
          .p { margin: 0.3rem 0; line-height: 1.6; }
          .note { margin: 0.6rem 0; padding: 0.55rem 0.7rem; border-left: 3px solid #cbd5e1; background: #f8fafc; }
          .appendix { margin: 1rem 0; padding: 0.7rem 0.8rem; border: 1px solid #e5e7eb; border-radius: 6px; }
          .x-small { font-size: 1.05rem; color: #4b5563; }
          .extract { margin: 0.65rem 0 0.65rem 1rem; padding-left: 0.8rem; border-left: 2px solid #d1d5db; }
          .math { margin: 0.5rem 0; text-align: center; }
          .cfr-table-wrap { max-width: 100%; overflow-x: auto; margin: 0.65rem 0; }
          table { border-collapse: collapse; width: 100%; margin: 0.45rem 0; font-size: 1.1rem; }
          caption { caption-side: top; text-align: left; font-weight: 700; margin-bottom: 0.25rem; }
          th, td { border: 1px solid #cbd5e1; padding: 0.25rem 0.35rem; vertical-align: top; }
          th { background: #f1f5f9; font-weight: 700; }
          img { max-width: 100%; height: auto; display: block; margin: 0.65rem 0; }
          .reg-tree-wrap { margin: 0.35em 0 0.95em 0; }
          .reg-tree-toolbar { display: flex; gap: 0.45em; margin: 0 0 0.35em 0; }
          .reg-tree-btn { border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; border-radius: 4px; padding: 0.1em 0.5em; font-size: 0.78em; cursor: pointer; }
          .reg-tree-btn:hover { background: #e2e8f0; }
          .reg-tree-view { position: relative; margin-left: 0.15em; padding-left: 0.95em; }
          .reg-tree-view::before { content: ''; position: absolute; left: 0.2em; top: 0.7em; bottom: 0.55em; border-left: 1px solid #cbd5e1; }
          .reg-tree-view .hidden { display: none !important; visibility: hidden; }
          .reg-tree-view .tree-leaf { position: relative; margin: 0.1em 0; }
          .reg-tree-view > .tree-leaf::before { content: ''; position: absolute; left: -0.75em; top: 0.83em; width: 0.75em; border-top: 1px solid #cbd5e1; }
          .reg-tree-view > .tree-leaf:last-child::after { content: ''; position: absolute; left: -0.75em; top: 0.84em; bottom: -0.4em; width: 1px; background: #fff; }
          .reg-tree-view .tree-child-leaves { position: relative; margin-left: 1.2em; padding-left: 0.95em; }
          .reg-tree-view .tree-child-leaves::before { content: ''; position: absolute; left: 0.2em; top: -0.2em; bottom: 0.55em; border-left: 1px solid #cbd5e1; }
          .reg-tree-view .tree-child-leaves > .tree-leaf::before { content: ''; position: absolute; left: -0.75em; top: 0.83em; width: 0.75em; border-top: 1px solid #cbd5e1; }
          .reg-tree-view .tree-child-leaves > .tree-leaf:last-child::after { content: ''; position: absolute; left: -0.75em; top: 0.84em; bottom: -0.4em; width: 1px; background: #fff; }
          .reg-tree-view .tree-leaf .tree-leaf-content { position: relative; min-height: 1.35em; }
          .reg-tree-view .tree-leaf .tree-expando { position: absolute; left: 0; top: 0.27em; float: none; width: 0.95em; height: 0.95em; line-height: 0.82em; font-size: 0.78em; background: #e2e8f0; border: 1px solid #cbd5e1; border-radius: 2px; color: #334155; box-sizing: border-box; text-align: center; }
          .reg-tree-view .tree-leaf .tree-expando:hover { background: #cbd5e1; }
          .reg-tree-view .tree-leaf .tree-leaf-text { float: none; display: block; margin-left: 1.45em; color: #111827; line-height: 1.45; white-space: normal; word-break: break-word; cursor: default; }
          .reg-tree-view .tree-leaf .tree-leaf-text:hover { color: #111827; }
          .reg-tree-view .tree-leaf .tree-leaf-text .reg-marker { font-weight: 700; }
        </style>
      </head>
      <body>
        <div id="layout">
          <aside id="sidebar">
            <div id="meta">
              <div class="meta-line">
                <strong>Title <xsl:value-of select="(/CFRDOC/FDSYS/CFRTITLE | /ROOT/FDSYS/CFRTITLE)[1]"/></strong>
                <xsl:if test="(/CFRDOC/FDSYS/TITLE | /ROOT/FDSYS/TITLE)[1]">
                  <xsl:text> — </xsl:text>
                  <xsl:value-of select="(/CFRDOC/FDSYS/TITLE | /ROOT/FDSYS/TITLE)[1]"/>
                </xsl:if>
              </div>
              <div class="meta-line">
                <xsl:text>Date: </xsl:text>
                <xsl:value-of select="(/CFRDOC/FDSYS/DATE | /ROOT/FDSYS/DATE)[1]"/>
              </div>
            </div>

            <ul id="toc">
              <xsl:apply-templates select="//PART" mode="toc"/>
            </ul>
          </aside>

          <main id="main">
            <xsl:apply-templates select="//PART" mode="content"/>
          </main>
        </div>

        <script>
          (function () {
            function normalizeText(value) {
              return (value || '').replace(/\s+/g, ' ').trim();
            }

            function classLevel(node) {
              if (!node || !node.className) return null;
              var className = String(node.className);
              var levelClass = className.match(/(?:^|\s)level-(\d+)(?:\s|$)/);
              if (levelClass) {
                var level = Number(levelClass[1]);
                if (!isNaN(level) &amp;&amp; level &gt;= 1) return level;
              }
              var depth = className.match(/\bP-D(\d+)\b/);
              if (depth) {
                var depthLevel = Number(depth[1]);
                if (!isNaN(depthLevel) &amp;&amp; depthLevel &gt;= 1) return depthLevel;
              }
              var pLevel = className.match(/\bP-L(\d+)\b/);
              if (pLevel) {
                var raw = Number(pLevel[1]);
                if (!isNaN(raw) &amp;&amp; raw &gt;= 1) {
                  if (raw === 2) return 1;
                  if (raw === 1) return 2;
                  return raw;
                }
              }
              return null;
            }

            function splitMarker(text) {
              var value = normalizeText(text);
              if (!value) return { marker: '', body: '' };
              var match = value.match(/^(\([A-Za-z0-9]+\)|[A-Za-z0-9]+[\.\)])(?:\s+|[—-]\s*)(.*)$/);
              if (!match) return { marker: '', body: value };
              return { marker: match[1], body: normalizeText(match[2]) };
            }

            function levelFromText(text) {
              var value = normalizeText(text);
              if (!value) return null;

              var paren = value.match(/^\(([A-Za-z0-9]+)\)(?:\s+|[—-]\s*|$)/);
              if (paren) {
                var token = paren[1];
                var lower = token.toLowerCase();
                if (/^\d+$/.test(token)) {
                  var parenTail = normalizeText(value.slice(paren[0].length));
                  if (token.length &gt;= 3 &amp;&amp; (/^\d/.test(parenTail) || /^\d{3}[-\s]\d{4}\b/.test(parenTail))) {
                    return null;
                  }
                  return 2;
                }
                if (/^[ivxlcdm]+$/.test(lower)) return 3;
                if (/^[A-Z]$/.test(token)) return 4;
                if (/^[a-z]$/.test(token)) return 1;
              }

              var dot = value.match(/^([A-Za-z0-9]+)[\.\)](?:\s+|[—-]\s*|$)/);
              if (dot) {
                var dotToken = dot[1];
                var dotLower = dotToken.toLowerCase();
                if (/^\d+$/.test(dotToken)) return 2;
                if (/^[ivxlcdm]+$/.test(dotLower)) return 3;
                if (/^[A-Z]$/.test(dotToken)) return 4;
                if (/^[a-z]$/.test(dotToken)) return 1;
              }

              return null;
            }

            function paragraphLevel(node) {
              var fromClass = classLevel(node);
              if (fromClass !== null) return fromClass;
              return levelFromText(node ? node.textContent : '');
            }

            function buildTreeData(paragraphNodes) {
              var roots = [];
              var stack = [];
              var usedNodes = [];
              var pendingLead = null;
              var leadLevelShiftBase = null;

              function isLeadParagraph(text) {
                if (!text) return false;
                // Treat unnumbered lines as potential chapeau/opening words
                // for the following numbered block unless they are bracketed cites.
                if (/^\[[^\]]+\]$/.test(text)) return false;
                return true;
              }

              paragraphNodes.forEach(function (pNode) {
                var rawText = normalizeText(pNode.textContent);
                if (!rawText) return;

                var level = paragraphLevel(pNode);
                if (level === null) {
                  if (isLeadParagraph(rawText)) {
                    pendingLead = { text: rawText, node: pNode };
                    leadLevelShiftBase = null;
                  } else {
                    pendingLead = null;
                    leadLevelShiftBase = null;
                  }
                  return;
                }

                if (pendingLead) {
                  var leadNode = {
                    name: pendingLead.text,
                    marker: '',
                    text: pendingLead.text,
                    level: 1,
                    expanded: false,
                    children: []
                  };
                  roots.push(leadNode);
                  stack.length = 0;
                  stack[0] = leadNode;
                  usedNodes.push(pendingLead.node);
                  leadLevelShiftBase = level || 1;
                  pendingLead = null;
                }

                if (leadLevelShiftBase !== null) {
                  if (level &lt; leadLevelShiftBase) {
                    leadLevelShiftBase = null;
                  } else {
                    level += 1;
                  }
                }

                while (level &gt; 1 &amp;&amp; !stack[level - 2]) {
                  level -= 1;
                }

                var markerInfo = splitMarker(rawText);
                var display = markerInfo.marker
                  ? markerInfo.marker + ' ' + markerInfo.body
                  : rawText;

                var node = {
                  name: display,
                  marker: markerInfo.marker,
                  text: markerInfo.body || rawText,
                  level: level,
                  expanded: false,
                  children: []
                };

                if (level === 1 || !stack[level - 2]) {
                  roots.push(node);
                  stack.length = 0;
                  stack[0] = node;
                  usedNodes.push(pNode);
                  return;
                }

                stack[level - 2].children.push(node);
                stack[level - 1] = node;
                stack.length = level;
                usedNodes.push(pNode);
              });

              return {
                nodes: roots,
                usedNodes: usedNodes
              };
            }

            function collectSectionParagraphs(section) {
              var nodes = [];
              Array.prototype.forEach.call(section.childNodes, function (child) {
                if (child.nodeType !== 1) return;
                if (!child.classList) return;
                if (child.classList.contains('p') || child.classList.contains('P')) {
                  nodes.push(child);
                }
              });
              return nodes;
            }

            function sectionMeta(section) {
              var titleNode = section.querySelector('.section-title');
              var heading = normalizeText(titleNode ? titleNode.textContent : '');
              var match = heading.match(/^(§?\s*[0-9A-Za-z.\-]+)\s+(.*)$/);
              if (!match) {
                return { section_no: heading, subject: '' };
              }
              return { section_no: match[1], subject: normalizeText(match[2]) };
            }

            function decorateTreeMarkers(treeHost) {
              var rows = treeHost.querySelectorAll('.tree-leaf-content');
              Array.prototype.forEach.call(rows, function (row) {
                var textNode = row.querySelector('.tree-leaf-text');
                if (!textNode) return;

                var dataText = row.getAttribute('data-item') || '{}';
                var item = null;
                try {
                  item = JSON.parse(dataText);
                } catch (err) {
                  return;
                }
                if (!item || !item.marker) return;

                while (textNode.firstChild) {
                  textNode.removeChild(textNode.firstChild);
                }

                var marker = document.createElement('span');
                marker.className = 'reg-marker';
                marker.textContent = item.marker;
                textNode.appendChild(marker);

                if (item.text) {
                  textNode.appendChild(document.createTextNode(' ' + item.text));
                }
              });
            }

            function renderTreeForSection(section, index) {
              var allParagraphs = collectSectionParagraphs(section);
              var treeBuilt = buildTreeData(allParagraphs);
              var treeData = treeBuilt.nodes;
              var usedNodes = treeBuilt.usedNodes;
              if (treeData.length === 0 || usedNodes.length === 0) return;

              var treeId = 'reg-tree-' + index;
              var meta = sectionMeta(section);
              var treeJson = {
                id: treeId,
                section_no: meta.section_no,
                subject: meta.subject,
                nodes: treeData
              };

              if (!window.__FAR_TREE_JSON) window.__FAR_TREE_JSON = [];
              window.__FAR_TREE_JSON.push(treeJson);

              var wrapper = document.createElement('div');
              wrapper.className = 'reg-tree-wrap';
              wrapper.setAttribute('data-reg-tree-id', treeId);

              var toolbar = document.createElement('div');
              toolbar.className = 'reg-tree-toolbar';

              var expandBtn = document.createElement('button');
              expandBtn.className = 'reg-tree-btn';
              expandBtn.type = 'button';
              expandBtn.textContent = 'Expand';

              var collapseBtn = document.createElement('button');
              collapseBtn.className = 'reg-tree-btn';
              collapseBtn.type = 'button';
              collapseBtn.textContent = 'Collapse';

              toolbar.appendChild(expandBtn);
              toolbar.appendChild(collapseBtn);
              wrapper.appendChild(toolbar);

              var treeHost = document.createElement('div');
              treeHost.className = 'reg-tree-view';
              treeHost.id = treeId;
              wrapper.appendChild(treeHost);

              section.insertBefore(wrapper, usedNodes[0]);

              usedNodes.forEach(function (node) {
                if (node.parentNode) node.parentNode.removeChild(node);
              });

              var tree = new TreeView(treeData, treeId);
              tree.collapseAll();
              decorateTreeMarkers(treeHost);

              expandBtn.addEventListener('click', function () {
                tree.expandAll();
              });
              collapseBtn.addEventListener('click', function () {
                tree.collapseAll();
              });
            }

            function initRegTrees() {
              if (typeof TreeView !== 'function') return;
              var sections = document.querySelectorAll('section.section');
              Array.prototype.forEach.call(sections, function (section, idx) {
                renderTreeForSection(section, idx + 1);
              });
            }

            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initRegTrees);
            } else {
              initRegTrees();
            }
          }());
        </script>
      </body>
    </html>
  </xsl:template>

  <xsl:template name="seq-id">
    <xsl:param name="sect"/>
    <xsl:value-of select="translate(normalize-space($sect), '§ &#x2009;', '')"/>
  </xsl:template>

  <xsl:template match="PART" mode="toc">
    <li>
      <div class="toc-part-title">
        <xsl:value-of select="normalize-space(EAR)"/>
        <xsl:if test="normalize-space(HD)">
          <xsl:text> — </xsl:text>
          <xsl:value-of select="normalize-space(HD)"/>
        </xsl:if>
      </div>
      <ul>
        <xsl:apply-templates select="CONTENTS" mode="toc"/>
      </ul>
    </li>
  </xsl:template>

  <xsl:template match="CONTENTS" mode="toc">
    <xsl:for-each select="SECTNO">
      <li class="toc-section">
        <a>
          <xsl:attribute name="href">
            <xsl:text>#seqnum</xsl:text>
            <xsl:call-template name="seq-id">
              <xsl:with-param name="sect" select="."/>
            </xsl:call-template>
          </xsl:attribute>
          <xsl:value-of select="normalize-space(.)"/>
          <xsl:if test="normalize-space(following-sibling::SUBJECT[1])">
            <xsl:text> </xsl:text>
            <xsl:value-of select="normalize-space(following-sibling::SUBJECT[1])"/>
          </xsl:if>
        </a>
      </li>
    </xsl:for-each>

    <xsl:for-each select="SUBPART">
      <li class="toc-subpart-title">
        <xsl:value-of select="normalize-space(HD)"/>
      </li>
      <xsl:for-each select="SECTNO">
        <li class="toc-section">
          <a>
            <xsl:attribute name="href">
              <xsl:text>#seqnum</xsl:text>
              <xsl:call-template name="seq-id">
                <xsl:with-param name="sect" select="."/>
              </xsl:call-template>
            </xsl:attribute>
            <xsl:value-of select="normalize-space(.)"/>
            <xsl:if test="normalize-space(following-sibling::SUBJECT[1])">
              <xsl:text> </xsl:text>
              <xsl:value-of select="normalize-space(following-sibling::SUBJECT[1])"/>
            </xsl:if>
          </a>
        </li>
      </xsl:for-each>

      <xsl:for-each select="SUBJGRP">
        <li class="toc-subjgrp-title">
          <xsl:value-of select="normalize-space(HD)"/>
        </li>
        <xsl:for-each select="SECTNO">
          <li class="toc-subjgrp-section">
            <a>
              <xsl:attribute name="href">
                <xsl:text>#seqnum</xsl:text>
                <xsl:call-template name="seq-id">
                  <xsl:with-param name="sect" select="."/>
                </xsl:call-template>
              </xsl:attribute>
              <xsl:value-of select="normalize-space(.)"/>
              <xsl:if test="normalize-space(following-sibling::SUBJECT[1])">
                <xsl:text> </xsl:text>
                <xsl:value-of select="normalize-space(following-sibling::SUBJECT[1])"/>
              </xsl:if>
            </a>
          </li>
        </xsl:for-each>
      </xsl:for-each>
    </xsl:for-each>
  </xsl:template>

  <xsl:template match="PART" mode="content">
    <article>
      <h1>
        <xsl:value-of select="normalize-space(EAR)"/>
        <xsl:if test="normalize-space(HD)">
          <xsl:text> — </xsl:text>
          <xsl:value-of select="normalize-space(HD)"/>
        </xsl:if>
      </h1>

      <xsl:apply-templates select="AUTH | SOURCE | EDNOTE | EFFDNOT | NOTE | APPRO" mode="content"/>
      <xsl:apply-templates select="SUBPART | SUBJGRP | SECTION | APPENDIX" mode="content"/>
    </article>
  </xsl:template>

  <xsl:template match="AUTH | SOURCE" mode="content">
    <div class="authority">
      <span class="label">
        <xsl:value-of select="normalize-space(HD)"/>
      </span>
      <xsl:text> </xsl:text>
      <xsl:for-each select="P">
        <xsl:if test="position() &gt; 1">
          <xsl:text> </xsl:text>
        </xsl:if>
        <xsl:value-of select="normalize-space(.)"/>
      </xsl:for-each>
    </div>
  </xsl:template>

  <xsl:template match="SUBPART" mode="content">
    <section>
      <h2><xsl:value-of select="normalize-space(HD)"/></h2>
      <xsl:apply-templates select="AUTH | SOURCE | EDNOTE | EFFDNOT | NOTE | APPRO | SUBJGRP | SECTION | APPENDIX" mode="content"/>
    </section>
  </xsl:template>

  <xsl:template match="SUBJGRP" mode="content">
    <section>
      <h3><xsl:value-of select="normalize-space(HD)"/></h3>
      <xsl:apply-templates select="SECTION | APPENDIX" mode="content"/>
    </section>
  </xsl:template>

  <xsl:template match="SECTION" mode="content">
    <xsl:variable name="sectno" select="normalize-space(SECTNO)"/>
    <xsl:variable name="subject" select="normalize-space(SUBJECT)"/>
    <section class="section">
      <xsl:attribute name="id">
        <xsl:text>seqnum</xsl:text>
        <xsl:call-template name="seq-id">
          <xsl:with-param name="sect" select="$sectno"/>
        </xsl:call-template>
      </xsl:attribute>
      <div class="section-title">
        <xsl:value-of select="$sectno"/>
        <xsl:if test="$subject != ''">
          <xsl:text> </xsl:text>
          <xsl:value-of select="$subject"/>
        </xsl:if>
      </div>
      <xsl:apply-templates select="node()[not(self::SECTNO or self::SUBJECT)]" mode="content"/>
    </section>
  </xsl:template>

  <xsl:template match="P | P2 | FP | FP-1 | FP-2 | FP-DASH | FP1-2 | PSPACE" mode="content">
    <p class="p">
      <xsl:if test="@LEVEL">
        <xsl:attribute name="class">
          <xsl:text>p level-</xsl:text>
          <xsl:value-of select="@LEVEL"/>
        </xsl:attribute>
      </xsl:if>
      <xsl:apply-templates mode="content"/>
    </p>
  </xsl:template>

  <xsl:template match="NOTE | EDNOTE | EFFDNOT | APPRO" mode="content">
    <div class="note">
      <div class="x-small"><strong><xsl:value-of select="normalize-space(HED)"/></strong></div>
      <xsl:apply-templates select="node()[not(self::HED)]" mode="content"/>
    </div>
  </xsl:template>

  <xsl:template match="APPENDIX" mode="content">
    <section class="appendix">
      <h4>
        <xsl:value-of select="normalize-space(EAR)"/>
        <xsl:if test="normalize-space(HD)">
          <xsl:text> — </xsl:text>
          <xsl:value-of select="normalize-space(HD)"/>
        </xsl:if>
      </h4>
      <xsl:apply-templates select="node()[not(self::EAR or self::HD)]" mode="content"/>
    </section>
  </xsl:template>

  <xsl:template match="XREF" mode="content">
    <p class="p x-small">
      <xsl:value-of select="normalize-space(.)"/>
    </p>
  </xsl:template>

  <xsl:template match="CITA | SECAUTH" mode="content">
    <p class="p x-small">
      <xsl:apply-templates mode="content"/>
    </p>
  </xsl:template>

  <xsl:template match="EXTRACT" mode="content">
    <div class="extract">
      <xsl:apply-templates mode="content"/>
    </div>
  </xsl:template>

  <xsl:template match="MATH" mode="content">
    <div class="math">
      <xsl:apply-templates mode="content"/>
    </div>
  </xsl:template>

  <xsl:template match="HD1" mode="content">
    <h2><xsl:apply-templates mode="content"/></h2>
  </xsl:template>

  <xsl:template match="HD2" mode="content">
    <h3><xsl:apply-templates mode="content"/></h3>
  </xsl:template>

  <xsl:template match="HD3" mode="content">
    <h4><xsl:apply-templates mode="content"/></h4>
  </xsl:template>

  <xsl:template match="TABLE" mode="content">
    <div class="cfr-table-wrap">
      <table>
        <xsl:copy-of select="@*"/>
        <xsl:apply-templates mode="content"/>
      </table>
    </div>
  </xsl:template>

  <xsl:template match="DIV | THEAD | TBODY | TFOOT | TR | TH | TD | CAPTION" mode="content">
    <xsl:element name="{translate(name(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')}">
      <xsl:copy-of select="@*"/>
      <xsl:apply-templates mode="content"/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="br" mode="content">
    <br/>
  </xsl:template>

  <xsl:template match="img" mode="content">
    <img>
      <xsl:attribute name="src">
        <xsl:choose>
          <xsl:when test="starts-with(@src, '/graphics/')">
            <xsl:text>https://www.ecfr.gov</xsl:text>
            <xsl:value-of select="@src"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="@src"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>
      <xsl:attribute name="alt"></xsl:attribute>
    </img>
  </xsl:template>

  <xsl:template match="I | em" mode="content">
    <em><xsl:apply-templates mode="content"/></em>
  </xsl:template>

  <xsl:template match="B | strong" mode="content">
    <strong><xsl:apply-templates mode="content"/></strong>
  </xsl:template>

  <xsl:template match="SUP | sup | SU" mode="content">
    <sup><xsl:apply-templates mode="content"/></sup>
  </xsl:template>

  <xsl:template match="SUB | sub" mode="content">
    <sub><xsl:apply-templates mode="content"/></sub>
  </xsl:template>

  <xsl:template match="U" mode="content">
    <u><xsl:apply-templates mode="content"/></u>
  </xsl:template>

  <xsl:template match="E | FR" mode="content">
    <span>
      <xsl:apply-templates mode="content"/>
    </span>
  </xsl:template>

  <xsl:template match="text()" mode="content">
    <xsl:value-of select="."/>
  </xsl:template>

  <xsl:template match="*" mode="content">
    <xsl:apply-templates mode="content"/>
  </xsl:template>
</xsl:stylesheet>
