<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:if test="@a and @b">
      <xsl:value-of select="@c or @d"/>
      <xsl:value-of select="@e and (f or g)"/>
      <xsl:value-of select="if (@h) then 'y' else 'n'"/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
