<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:if test="a"><xsl:text>hello</xsl:text></xsl:if>
    <xsl:if test="b"><xsl:text>&amp;</xsl:text></xsl:if>
    <xsl:if test="c"><xsl:text>&lt;</xsl:text></xsl:if>
    <xsl:if test="d"><xsl:text>a &amp; b &lt; c</xsl:text></xsl:if>
  </xsl:template>
</xsl:stylesheet>
