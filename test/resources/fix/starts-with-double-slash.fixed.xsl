<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:key name="lookup" match="keyed" use="@id"/>
  <xsl:template match="objects">
    <xsl:copy-of select="."/>
  </xsl:template>
  <xsl:template match="nested/deep">
    <xsl:number count="numbered" from="started"/>
  </xsl:template>
</xsl:stylesheet>
