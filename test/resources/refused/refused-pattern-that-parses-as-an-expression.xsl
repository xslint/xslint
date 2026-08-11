<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="declared">
  <xsl:output encoding="UTF-8" method="xml"/>
  <xsl:template match="//alpha | 1 + 1">
    <xsl:value-of select="beta"/>
  </xsl:template>
  <xsl:template match="//gamma">
    <xsl:value-of select="delta"/>
  </xsl:template>
</xsl:stylesheet>
