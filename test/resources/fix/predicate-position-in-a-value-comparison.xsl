<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:fn="http://www.w3.org/2005/xpath-functions">
  <xsl:template match="/">
    <xsl:value-of select="row[position() eq 1]"/>
    <xsl:value-of select="cell[ position() = 2 ]"/>
    <xsl:value-of select="last[position() eq fn:last()]"/>
  </xsl:template>
</xsl:stylesheet>
