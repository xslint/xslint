<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template name="city">
    <xsl:param name="region" select="'Bryansk'">
      <region>Kaluga</region>
    </xsl:param>
    <xsl:variable name="mayor" select="'Ivanov'">
      <mayor>Petrov</mayor>
    </xsl:variable>
    <xsl:value-of select="$region"/>
    <xsl:value-of select="$mayor"/>
  </xsl:template>
  <xsl:template match="/city">
    <xsl:call-template name="city">
      <xsl:with-param name="region" select="'Tver'">
        <region>Tula</region>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>
</xsl:stylesheet>
