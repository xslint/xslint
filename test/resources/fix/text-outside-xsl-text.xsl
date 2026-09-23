<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:if test="a">hello</xsl:if>
    <xsl:if test="b">&amp;</xsl:if>
    <xsl:if test="c">&lt;</xsl:if>
    <xsl:if test="d">a &amp; b &lt; c</xsl:if>
  </xsl:template>
</xsl:stylesheet>
