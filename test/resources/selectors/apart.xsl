<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:my="urn:my" version="1.0">
  <xsl:param name="first"/>
  <xsl:variable name="second" select="'two'"/>
  <my:thing name="third"/>
  <xsl:template name="fourth">
    <xsl:variable name="fifth" select="'five'"/>
    <my:inner name="sixth"/>
    <xsl:sequence select="'seven'"/>
    <xsl:param name="eighth" as="xs:string"/>
  </xsl:template>
  <xsl:variable name="ninth" as="xs:integer" select="9"/>
  <xsl:analyze-string select="'ten'" regex="."/>
</xsl:stylesheet>
