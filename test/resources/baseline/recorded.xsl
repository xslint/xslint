<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="style">
  <xsl:output encoding="UTF-8" method="html"/>
  <xsl:template match="/">
    <html>
      <body>
        <h2>My CD Collection</h2>
        <xsl:apply-templates/>
      </body>
    </html>
  </xsl:template>
  <xsl:variable name="c">
    <xsl:value-of select="'RUSSIA'"/>
  </xsl:variable>
  <xsl:template match="cd">
    <p>
      <xsl:if test="./country=$c">
        <xsl:apply-templates select="title"/>
        <xsl:apply-templates select="artist"/>
      </xsl:if>
      <xsl:choose>
        <xsl:when test="price &lt; 300"/>
        <xsl:otherwise/>
      </xsl:choose>
    </p>
  </xsl:template>
  <xsl:template match="//title">
    <xsl:text>Title: </xsl:text>
    <span style="color:#ff0000">
      <xsl:value-of select="."/>
    </span>
    <br/>
  </xsl:template>
  <xsl:template match="artist">
    <xsl:text>Artist:</xsl:text>
    <span style="color:#00ff00">
      <xsl:value-of select="."/>
    </span>
    <br/>
  </xsl:template>
  <xsl:template name="year">
    <xsl:text>Artist:</xsl:text>
    <span style="color:#0000ff">
      <xsl:value-of select="."/>
    </span>
    <br/>
  </xsl:template>
</xsl:stylesheet>
