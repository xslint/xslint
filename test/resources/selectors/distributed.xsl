<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="two">
  <xsl:output method="xml" version="1.0"/>
  <xsl:template match="alpha" name="one">
    <thing xsl:version="later"/>
    <other xsl:version="2.0"/>
    <xsl:variable name="beta" select="'1.0'"/>
  </xsl:template>
  <xsl:template match="gamma">
    <deep xsl:version="nor this"/>
  </xsl:template>
</xsl:stylesheet>
