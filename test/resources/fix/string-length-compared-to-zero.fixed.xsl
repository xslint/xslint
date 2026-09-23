<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="sl-fix">
  <xsl:template match="/">
    <xsl:if test="@a != ''">
      <xsl:variable name="blank" select="@b = ''"/>
      <xsl:value-of select="@c != ''"/>
      <xsl:value-of select='@d != &apos;&apos;'/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
