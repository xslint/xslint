<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="R/child::qwer">
    <xsl:value-of select="child::title"/>
    <xsl:value-of select="attribute::name"/>
    <xsl:value-of select="child::a/child::b/attribute::c"/>
    <xsl:apply-templates select="parent::node()"/>
    <xsl:value-of select="self::node()"/>
    <xsl:value-of select="parent :: node ( )"/>
    <xsl:value-of select="parent::n"/>
    <xsl:value-of select="self::text()"/>
    <xsl:value-of select="attribute::  spaced"/>
    <xsl:value-of select="child::  gapped"/>
  </xsl:template>
</xsl:stylesheet>
