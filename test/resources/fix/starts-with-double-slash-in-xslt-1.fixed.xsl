<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:key name="kappa" match="lambda" use="@ref"/>
  <xsl:template match="//sigma">
    <xsl:number count="tau" from="upsilon"/>
  </xsl:template>
</xsl:stylesheet>
