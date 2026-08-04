<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0" id="refused">
  <xsl:output encoding="UTF-8" method="xml"/>
  <xsl:template match="/">
    <xsl:value-of select="child::"/>
    <xsl:if test="count(alpha) = 0 (">
      <xsl:value-of select="."/>
    </xsl:if>
    <xsl:value-of select="child::beta"/>
    <xsl:value-of select="child ::gamma"/>
  </xsl:template>
</xsl:stylesheet>
