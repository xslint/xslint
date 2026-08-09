<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match = "objects">
    <xsl:value-of select  =  ".//title"/>
    <xsl:if
      test = "true()">
      <p>yes</p>
    </xsl:if>
    <xsl:variable name="items" select="/root/item"/>
    <xsl:apply-templates select='$items'/>
  </xsl:template>
</xsl:stylesheet>
