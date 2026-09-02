<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
  <xsl:template match="section">
    <xsl:value-of select="@x"/>
    <widget xsl:version="2.0" label="{count(item)}">
      <xsl:value-of select="@y"/>
    </widget>
    <xsl:if test="@z" version="3.0">
      <xsl:value-of select="@w"/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
