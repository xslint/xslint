<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="sl-fix">
  <xsl:template match="/">
    <xsl:if test="string-length(@a) > 0">
      <xsl:variable name="blank" select="string-length(@b) = 0"/>
      <xsl:value-of select="0 != string-length(@c)"/>
      <xsl:value-of select='string-length(@d) != 0'/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
