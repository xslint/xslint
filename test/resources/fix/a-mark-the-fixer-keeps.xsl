<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="a-mark">
  <xsl:output method="xml"/>
  <xsl:template match="/">
    <xsl:if test="count(item) > 0">
      <xsl:value-of select="item"/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
