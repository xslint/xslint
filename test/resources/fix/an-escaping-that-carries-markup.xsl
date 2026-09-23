<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="3.0" expand-text="yes">
  <xsl:param name="echo"/>
  <xsl:template match="/">
    <xsl:text disable-output-escaping="yes">&lt;br/&gt;</xsl:text>
    <xsl:text disable-output-escaping="yes">alpha &amp; bravo</xsl:text>
    <xsl:text disable-output-escaping="yes">charlie &gt; delta</xsl:text>
    <xsl:text disable-output-escaping="yes">{$echo}</xsl:text>
    <xsl:value-of select="foxtrot" disable-output-escaping="yes"/>
  </xsl:template>
</xsl:stylesheet>
