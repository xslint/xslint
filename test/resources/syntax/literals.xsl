<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="3.0">
  <xsl:template match="/">
    <xsl:value-of select="'plain'"/>
    <xsl:value-of select="&quot;plain&quot;"/>
    <xsl:value-of select="'it''s'"/>
    <xsl:value-of select="&quot;say &quot;&quot;hi&quot;&quot;&quot;"/>
    <xsl:value-of select="''"/>
    <xsl:value-of select="&quot;it's&quot;"/>
    <xsl:value-of select="42"/>
    <xsl:value-of select="@a"/>
  </xsl:template>
</xsl:stylesheet>
