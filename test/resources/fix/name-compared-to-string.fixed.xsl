<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="name-fix">
  <xsl:template match="/">
    <xsl:if test="self::div">
      <xsl:variable name="body" select="not(self::span)"/>
      <xsl:value-of select="self::*:p"/>
      <xsl:value-of select="self::em"/>
      <xsl:copy-of select="@*[name() != 'as']"/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
