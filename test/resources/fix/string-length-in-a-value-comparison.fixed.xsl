<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:if test="@name eq ''">
      <xsl:value-of select="@title ne ''"/>
      <xsl:value-of select="@note ne ''"/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
