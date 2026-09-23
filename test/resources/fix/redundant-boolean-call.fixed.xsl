<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:if test="@enabled and normalize-space(title)">
      <p>on</p>
    </xsl:if>
    <xsl:if test="@width &lt; 1">
      <p>narrow</p>
    </xsl:if>
    <xsl:if test="@kind = &quot;wide&quot;">
      <p>wide</p>
    </xsl:if>
    <xsl:if test='@mode = &apos;draft&apos;'>
      <p>draft</p>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
