<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:my="urn:my" version="3.0">
  <xsl:variable name="1st" select="'digit'"/>
  <xsl:template match="gamma"/>
  <xsl:template name="alpha">
    <xsl:variable name="a" select="'one'"/>
    <xsl:choose>
      <xsl:when test="@x">
        <xsl:variable name="inside" select="'two'"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:variable name="beside" select="'three'"/>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:otherwise/>
    <xsl:when test="@y"/>
  </xsl:template>
  <xsl:function name="my:z">
    <xsl:sequence select="'four'"/>
  </xsl:function>
  <xsl:function name="my:9th">
    <xsl:sequence select="'five'"/>
  </xsl:function>
  <xsl:template match="beta">
    <xsl:variable name="b" select="'six'"/>
    <xsl:variable name="2nd" select="'digit'"/>
  </xsl:template>
</xsl:stylesheet>
