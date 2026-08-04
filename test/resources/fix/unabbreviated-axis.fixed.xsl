<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="R/qwer">
    <xsl:value-of select="title"/>
    <xsl:value-of select="@name"/>
    <xsl:value-of select="a/b/@c"/>
    <xsl:apply-templates select=".."/>
    <xsl:value-of select="."/>
    <xsl:value-of select=".."/>
    <xsl:value-of select="parent::n"/>
    <xsl:value-of select="self::text()"/>
    <xsl:value-of select="@spaced"/>
    <xsl:value-of select="gapped"/>
  </xsl:template>
</xsl:stylesheet>
