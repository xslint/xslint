<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:value-of select = ".//a[@x &lt; 1]"/>
    <xsl:value-of select = ".//b[@y = &quot;z&quot;]"/>
    <xsl:value-of select='.//c[@w = &apos;q&apos;]'/>
    <xsl:value-of select = ".//d[@v = 'p &amp; q']"/>
    <xsl:value-of select = ".//e[@u > 3]"/>
  </xsl:template>
</xsl:stylesheet>
