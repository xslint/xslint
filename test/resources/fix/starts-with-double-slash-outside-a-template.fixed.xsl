<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:key name="kk" match="keyed" use="@id"/>
  <xsl:template match="kept">
    <xsl:number count="counted" from="started"/>
    <xsl:for-each-group select="oo" group-starting-with="grouped" group-ending-with="ended">
      <xsl:copy-of select="."/>
    </xsl:for-each-group>
  </xsl:template>
  <xsl:accumulator name="acc" initial-value="0">
    <xsl:accumulator-rule match="accumulated" select="1"/>
  </xsl:accumulator>
</xsl:stylesheet>
