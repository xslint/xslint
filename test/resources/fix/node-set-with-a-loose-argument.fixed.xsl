<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:exsl="http://exslt.org/common" version="2.0" exclude-result-prefixes="exsl">
  <xsl:template match="/">
    <xsl:value-of select="($x | $y)/title"/>
    <xsl:if test="($x | $y)/author">
      <widget name="{($x | $y)/name}"/>
    </xsl:if>
    <xsl:value-of select="(alpha/beta)[1]"/>
    <xsl:value-of select="$x | $y"/>
  </xsl:template>
</xsl:stylesheet>
