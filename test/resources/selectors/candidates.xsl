<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:my="urn:my" version="3.0">
  <xsl:variable name="one">
    <a x="1"/>
  </xsl:variable>
  <xsl:variable name="two">
    <a x="2"/>
    <a x="3"/>
  </xsl:variable>
  <xsl:variable name="three">
    <b x="1"/>
  </xsl:variable>
  <xsl:variable name="four">
    <a x="0"/>
  </xsl:variable>
  <xsl:variable name="five" as="xs:string" select="'v'"/>
  <xsl:variable name="six" select="'w'">
    <my:thing x="1"/>
  </xsl:variable>
  <xsl:variable name="seven" mode="m"/>
  <xsl:variable name="eight" priority="2" match="c"/>
  <xsl:template match="d">
    <xsl:variable name="nine">
      <a/>
    </xsl:variable>
  </xsl:template>
  <xsl:variable name="ten">
    <xsl:text>alpha</xsl:text>
  </xsl:variable>
  <xsl:variable name="𐀀" select="'x'"/>
  <xsl:variable name="my:𐀀"/>
</xsl:stylesheet>
