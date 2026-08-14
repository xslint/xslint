<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:exsl="http://exslt.org/common" version="2.0">
  <xsl:template match="/">
    <xsl:value-of select="exsl:node-set($x)/title"/>
    <xsl:if test="exsl:node-set($x)/author">
      <xsl:value-of select="'seen'"/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
