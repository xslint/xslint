<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:if test="count(item) &gt; 0">
      <hit/>
    </xsl:if>
    <xsl:if test="count(&#105;tem) &gt; 0">
      <hit/>
    </xsl:if>
    <xsl:if test="count(o&#x74;her) &gt; 0">
      <hit/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
