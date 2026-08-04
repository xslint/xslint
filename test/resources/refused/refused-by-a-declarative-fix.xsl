<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="3.0" expand-text="yes" id="declared">
  <xsl:output encoding="UTF-8" method="xml"/>
  <xsl:template match="//child::">
    <xsl:value-of select="//child::"/>
  </xsl:template>
  <xsl:template match="//alpha">
    <xsl:value-of select="//beta"/>
  </xsl:template>
  <xsl:template match="//gamma">delta {1 +} epsilon</xsl:template>
</xsl:stylesheet>
